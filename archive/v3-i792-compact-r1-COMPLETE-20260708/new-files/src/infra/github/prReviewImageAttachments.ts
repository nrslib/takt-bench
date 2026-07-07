import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PrReviewComment, PrReviewData } from '../git/types.js';
import type { StoredImageAttachment } from '../../shared/types/image-attachments.js';
import {
  MAX_IMAGE_ATTACHMENT_BYTES,
  SUPPORTED_IMAGE_MIME_TYPES,
  getImageFileExtension,
  inferImageMimeTypeFromMagicBytes,
  isSupportedImageMimeType,
} from '../../shared/utils/imageData.js';

export const MAX_PR_REVIEW_IMAGE_ATTACHMENT_BYTES = MAX_IMAGE_ATTACHMENT_BYTES;

const PR_IMAGE_TMP_NAMESPACE = 'pr-attachments';
const GITHUB_HOST = 'github.com';
const USER_ATTACHMENTS_PATH_PREFIX = '/user-attachments/assets/';
const GITHUB_IMAGE_ACCEPT_HEADER = SUPPORTED_IMAGE_MIME_TYPES.join(',');
const GITHUB_IMAGE_USER_AGENT = 'takt-pr-image-attachments';

export interface PrReviewImageReference {
  url: string;
  originalText: string;
  index: number;
}

export interface ResolvePrReviewImageAttachmentsOptions {
  cwd: string | undefined;
  tmpRoot?: string;
  fetch?: typeof fetch;
  getAuthToken?: (cwd: string | undefined) => string;
}

export interface ResolvedPrReviewImageAttachments {
  prReview: PrReviewData;
  attachments: StoredImageAttachment[];
  cleanup: () => void;
}

interface PlannedAttachment {
  url: string;
  placeholder: string;
  sequence: number;
}

function getDefaultGitHubAuthToken(cwd: string | undefined): string {
  return execFileSync('gh', ['auth', 'token'], {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function createPrImageTempDirectory(tmpRoot: string | undefined): { attachmentDir: string; sessionDir: string } {
  const sessionDir = path.join(tmpRoot ?? os.tmpdir(), 'takt', PR_IMAGE_TMP_NAMESPACE, randomUUID());
  const attachmentDir = path.join(sessionDir, 'attachments');
  fs.mkdirSync(attachmentDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(sessionDir, 0o700);
  fs.chmodSync(attachmentDir, 0o700);
  return { attachmentDir, sessionDir };
}

export function isAllowedGitHubAttachmentUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== GITHUB_HOST) {
    return false;
  }
  if (parsed.pathname.startsWith(USER_ATTACHMENTS_PATH_PREFIX)) {
    return parsed.pathname.length > USER_ATTACHMENTS_PATH_PREFIX.length;
  }

  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
  return segments.length >= 4 && segments[2] === 'assets';
}

export function extractPrReviewImageReferences(text: string): PrReviewImageReference[] {
  const markdownPattern = /!\[[^\]\r\n]*\]\((https:\/\/[^\s)]+)\)/g;
  const htmlPattern = /<img\b[^>]*\bsrc\s*=\s*(["'])(https:\/\/.*?)\1[^>]*>/gi;
  const markdownReferences = Array.from(text.matchAll(markdownPattern), (match) => (
    match.index !== undefined && match[0] && match[1]
      ? {
        url: match[1],
        originalText: match[0],
        index: match.index,
      }
      : null
  )).filter((reference): reference is PrReviewImageReference => reference !== null);
  const htmlReferences = Array.from(text.matchAll(htmlPattern), (match) => (
    match.index !== undefined && match[0] && match[2]
      ? {
        url: match[2],
        originalText: match[0],
        index: match.index,
      }
      : null
  )).filter((reference): reference is PrReviewImageReference => reference !== null);

  return [...markdownReferences, ...htmlReferences].reduce<PrReviewImageReference[]>(
    (orderedReferences, reference) => {
      const insertIndex = orderedReferences.findIndex((existing) => reference.index < existing.index);
      if (insertIndex === -1) {
        return [...orderedReferences, reference];
      }
      return [
        ...orderedReferences.slice(0, insertIndex),
        reference,
        ...orderedReferences.slice(insertIndex),
      ];
    },
    [],
  );
}

function collectPlannedAttachments(prReview: PrReviewData): Map<string, PlannedAttachment> {
  const planned = new Map<string, PlannedAttachment>();
  const texts = [
    prReview.body,
    ...prReview.comments.map((comment) => comment.body),
    ...prReview.reviews.map((review) => review.body),
  ];

  for (const text of texts) {
    for (const reference of extractPrReviewImageReferences(text)) {
      if (!isAllowedGitHubAttachmentUrl(reference.url) || planned.has(reference.url)) {
        continue;
      }
      const sequence = planned.size + 1;
      planned.set(reference.url, {
        url: reference.url,
        placeholder: `[Image #${sequence}]`,
        sequence,
      });
    }
  }
  return planned;
}

function replaceImageReferences(text: string, plannedByUrl: ReadonlyMap<string, PlannedAttachment>): string {
  const references = extractPrReviewImageReferences(text);
  if (references.length === 0) {
    return text;
  }

  let output = '';
  let cursor = 0;
  for (const reference of references) {
    const planned = plannedByUrl.get(reference.url);
    if (!planned) {
      continue;
    }
    output += text.slice(cursor, reference.index);
    output += planned.placeholder;
    cursor = reference.index + reference.originalText.length;
  }
  output += text.slice(cursor);
  return output;
}

function replaceCommentImageReferences(
  comments: readonly PrReviewComment[],
  plannedByUrl: ReadonlyMap<string, PlannedAttachment>,
): PrReviewComment[] {
  return comments.map((comment) => ({
    ...comment,
    body: replaceImageReferences(comment.body, plannedByUrl),
  }));
}

function buildResolvedPrReview(prReview: PrReviewData, plannedByUrl: ReadonlyMap<string, PlannedAttachment>): PrReviewData {
  return {
    ...prReview,
    body: replaceImageReferences(prReview.body, plannedByUrl),
    comments: replaceCommentImageReferences(prReview.comments, plannedByUrl),
    reviews: replaceCommentImageReferences(prReview.reviews, plannedByUrl),
  };
}

function getValidatedContentLength(response: Response): number | undefined {
  const header = response.headers.get('content-length');
  if (header === null) {
    return undefined;
  }
  const contentLength = Number.parseInt(header, 10);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    throw new Error(`Invalid PR image Content-Length: ${header}`);
  }
  if (contentLength > MAX_PR_REVIEW_IMAGE_ATTACHMENT_BYTES) {
    throw new Error(`PR image exceeds the ${MAX_PR_REVIEW_IMAGE_ATTACHMENT_BYTES} byte limit.`);
  }
  return contentLength;
}

function resolveResponseContentType(response: Response): string {
  const rawContentType = response.headers.get('content-type');
  if (rawContentType === null) {
    throw new Error('PR image response is missing Content-Type.');
  }
  const contentType = rawContentType.split(';', 1)[0]?.trim().toLowerCase();
  if (!contentType || !isSupportedImageMimeType(contentType)) {
    throw new Error(`Unsupported PR image Content-Type: ${rawContentType}`);
  }
  return contentType;
}

async function readLimitedResponseBody(response: Response): Promise<Buffer> {
  const body = response.body;
  if (!body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_PR_REVIEW_IMAGE_ATTACHMENT_BYTES) {
      throw new Error(`PR image exceeds the ${MAX_PR_REVIEW_IMAGE_ATTACHMENT_BYTES} byte limit.`);
    }
    return buffer;
  }

  const reader = body.getReader();
  let chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    const chunk = Buffer.from(value);
    total += chunk.length;
    if (total > MAX_PR_REVIEW_IMAGE_ATTACHMENT_BYTES) {
      throw new Error(`PR image exceeds the ${MAX_PR_REVIEW_IMAGE_ATTACHMENT_BYTES} byte limit.`);
    }
    chunks = [...chunks, chunk];
  }
  return Buffer.concat(chunks, total);
}

function validateImageData(contentType: string, data: Buffer): void {
  const dataMimeType = inferImageMimeTypeFromMagicBytes(data);
  if (!dataMimeType) {
    throw new Error('Unsupported PR image data type. Expected PNG, JPEG, GIF, or WebP data.');
  }
  if (dataMimeType !== contentType) {
    throw new Error(`PR image Content-Type does not match image data: ${contentType} !== ${dataMimeType}`);
  }
}

async function downloadPrImageAttachment(
  planned: PlannedAttachment,
  options: {
    attachmentDir: string;
    fetchImage: typeof fetch;
    token: string;
  },
): Promise<StoredImageAttachment> {
  const response = await options.fetchImage(planned.url, {
    headers: {
      authorization: `Bearer ${options.token}`,
      accept: GITHUB_IMAGE_ACCEPT_HEADER,
      'user-agent': GITHUB_IMAGE_USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download PR image ${planned.url}: ${response.status} ${response.statusText}`);
  }

  getValidatedContentLength(response);
  const contentType = resolveResponseContentType(response);
  const data = await readLimitedResponseBody(response);
  validateImageData(contentType, data);

  const fileName = `image-${planned.sequence}.${getImageFileExtension(contentType)}`;
  const tempPath = path.join(options.attachmentDir, fileName);
  fs.writeFileSync(tempPath, data, { mode: 0o600, flag: 'wx' });
  return {
    placeholder: planned.placeholder,
    tempPath,
    fileName,
  };
}

function resolveAuthToken(options: ResolvePrReviewImageAttachmentsOptions): string {
  const token = (options.getAuthToken ?? getDefaultGitHubAuthToken)(options.cwd).trim();
  if (!token) {
    throw new Error('GitHub authentication token is required to download PR image attachments.');
  }
  return token;
}

export async function resolvePrReviewImageAttachments(
  prReview: PrReviewData,
  options: ResolvePrReviewImageAttachmentsOptions,
): Promise<ResolvedPrReviewImageAttachments> {
  const plannedByUrl = collectPlannedAttachments(prReview);
  if (plannedByUrl.size === 0) {
    return {
      prReview,
      attachments: [],
      cleanup: () => undefined,
    };
  }

  const { attachmentDir, sessionDir } = createPrImageTempDirectory(options.tmpRoot);
  const cleanup = (): void => {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  };

  try {
    const token = resolveAuthToken(options);
    const fetchImage = options.fetch ?? fetch;
    let attachments: StoredImageAttachment[] = [];
    for (const planned of plannedByUrl.values()) {
      const attachment = await downloadPrImageAttachment(planned, {
        attachmentDir,
        fetchImage,
        token,
      });
      attachments = [...attachments, attachment];
    }
    return {
      prReview: buildResolvedPrReview(prReview, plannedByUrl),
      attachments,
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
