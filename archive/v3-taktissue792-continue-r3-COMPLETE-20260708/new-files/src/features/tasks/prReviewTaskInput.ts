import { execFileSync } from 'node:child_process';
import type { PrReviewComment, PrReviewData } from '../../infra/git/types.js';
import { formatPrReviewAsTask } from '../../infra/git/format.js';
import {
  cleanupImageAttachmentStore,
  createSessionImageAttachmentStore,
  type ImageAttachmentStore,
} from '../interactive/imageAttachments.js';
import type { TaskAttachment } from './attachments.js';
import {
  inferImageMimeTypeFromMagicBytes,
  MAX_IMAGE_ATTACHMENT_BYTES,
  normalizeImageContentType,
  type SupportedImageMimeType,
} from '../../shared/utils/imageTypes.js';

export interface PrReviewTaskInput {
  task: string;
  attachments?: TaskAttachment[];
  cleanupAttachments?: () => void;
}

interface ImageReferenceMatch {
  start: number;
  end: number;
  raw: string;
  url: string;
}

interface PrImageReferenceResolver {
  resolve(url: string): Promise<string | undefined>;
  listAttachments(): TaskAttachment[];
  cleanup(): void;
}

const GITHUB_USER_ATTACHMENTS_HOST = 'github.com';
const USER_IMAGES_HOST = 'user-images.githubusercontent.com';
const PRIVATE_USER_IMAGES_HOST = 'private-user-images.githubusercontent.com';
const GITHUB_IMAGE_ATTACHMENT_USER_AGENT = 'takt';

function getGithubAuthToken(cwd: string): string {
  const token = execFileSync('gh', ['auth', 'token'], {
    cwd,
    encoding: 'utf8',
  }).trim();
  if (token.length === 0) {
    throw new Error('GitHub authentication token is empty.');
  }
  return token;
}

function isAllowedGithubImageUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') {
    return false;
  }

  if (url.hostname === USER_IMAGES_HOST || url.hostname === PRIVATE_USER_IMAGES_HOST) {
    return url.pathname !== '/';
  }
  if (url.hostname !== GITHUB_USER_ATTACHMENTS_HOST) {
    return false;
  }

  const segments = url.pathname.split('/').filter((segment) => segment.length > 0);
  const isUserAttachment = segments.length >= 3 && segments[0] === 'user-attachments' && segments[1] === 'assets';
  const isRepositoryAsset = segments.length >= 4 && segments[2] === 'assets';
  return isUserAttachment || isRepositoryAsset;
}

function contentTypeFromResponse(url: string, response: Response): SupportedImageMimeType {
  const contentTypeHeader = response.headers.get('content-type');
  if (!contentTypeHeader) {
    throw new Error(`GitHub image attachment response is missing Content-Type: ${url}`);
  }
  const contentType = normalizeImageContentType(contentTypeHeader);
  if (!contentType) {
    throw new Error(`Unsupported GitHub image attachment Content-Type: ${contentTypeHeader}`);
  }
  return contentType;
}

function validateContentLength(url: string, response: Response): void {
  const contentLengthHeader = response.headers.get('content-length');
  if (!contentLengthHeader) {
    return;
  }
  if (!/^\d+$/.test(contentLengthHeader)) {
    throw new Error(`GitHub image attachment has invalid Content-Length: ${contentLengthHeader}`);
  }
  const contentLength = Number.parseInt(contentLengthHeader, 10);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    throw new Error(`GitHub image attachment has invalid Content-Length: ${contentLengthHeader}`);
  }
  if (contentLength > MAX_IMAGE_ATTACHMENT_BYTES) {
    throw new Error(`GitHub image attachment exceeds the ${MAX_IMAGE_ATTACHMENT_BYTES} byte limit: ${url}`);
  }
}

async function readLimitedResponseBody(url: string, response: Response): Promise<Buffer> {
  validateContentLength(url, response);
  if (!response.body) {
    throw new Error(`GitHub image attachment response is missing a body stream: ${url}`);
  }

  const reader = response.body.getReader();
  let chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }
    totalBytes += result.value.byteLength;
    if (totalBytes > MAX_IMAGE_ATTACHMENT_BYTES) {
      const limitError = new Error(`GitHub image attachment exceeds the ${MAX_IMAGE_ATTACHMENT_BYTES} byte limit: ${url}`);
      await reader.cancel(limitError);
      throw limitError;
    }
    chunks = [...chunks, result.value];
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);
}

function validateDownloadedImage(url: string, data: Buffer, contentType: SupportedImageMimeType): SupportedImageMimeType {
  const magicMimeType = inferImageMimeTypeFromMagicBytes(data);
  if (!magicMimeType) {
    throw new Error(`GitHub image attachment has unsupported image data or magic bytes: ${url}`);
  }
  if (magicMimeType !== contentType) {
    throw new Error(`GitHub image attachment Content-Type mismatch with magic bytes: ${contentType} !== ${magicMimeType}`);
  }
  return magicMimeType;
}

async function downloadGithubImageAttachment(
  cwd: string,
  url: string,
  attachmentStore: ImageAttachmentStore,
): Promise<TaskAttachment> {
  const token = getGithubAuthToken(cwd);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': GITHUB_IMAGE_ATTACHMENT_USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download GitHub image attachment: HTTP ${response.status}`);
  }

  const contentType = contentTypeFromResponse(url, response);
  const data = await readLimitedResponseBody(url, response);
  const mimeType = validateDownloadedImage(url, data, contentType);
  return attachmentStore.saveImage(data, mimeType);
}

function createCleanup(attachmentStore: ImageAttachmentStore): () => void {
  let cleaned = false;
  return () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    cleanupImageAttachmentStore(attachmentStore);
  };
}

function createPrImageReferenceResolver(cwd: string): PrImageReferenceResolver {
  const attachmentStore = createSessionImageAttachmentStore();
  const attachmentsByUrl = new Map<string, TaskAttachment>();

  return {
    async resolve(url: string): Promise<string | undefined> {
      if (!isAllowedGithubImageUrl(url)) {
        return undefined;
      }
      const existing = attachmentsByUrl.get(url);
      if (existing) {
        return formatAttachmentReference(existing);
      }
      const attachment = await downloadGithubImageAttachment(cwd, url, attachmentStore);
      attachmentsByUrl.set(url, attachment);
      return formatAttachmentReference(attachment);
    },

    listAttachments(): TaskAttachment[] {
      return attachmentStore.listAttachments();
    },

    cleanup: createCleanup(attachmentStore),
  };
}

function formatAttachmentReference(attachment: TaskAttachment): string {
  return `${attachment.placeholder} (\`${attachment.tempPath}\`)`;
}

function findImageReferences(body: string): ImageReferenceMatch[] {
  let matches: ImageReferenceMatch[] = [];
  const markdownImagePattern = /!\[[^\]\r\n]*\]\(([^)\s]+)\)/g;
  const htmlImagePattern = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi;

  for (const match of body.matchAll(markdownImagePattern)) {
    if (match.index === undefined || match[1] === undefined || match[0] === undefined) {
      continue;
    }
    matches = [...matches, {
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      url: match[1],
    }];
  }
  for (const match of body.matchAll(htmlImagePattern)) {
    if (match.index === undefined || match[2] === undefined || match[0] === undefined) {
      continue;
    }
    matches = [...matches, {
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      url: match[2],
    }];
  }

  return matches.sort((left, right) => left.start - right.start);
}

async function replaceImageReferences(body: string, resolver: PrImageReferenceResolver): Promise<string> {
  const matches = findImageReferences(body);
  if (matches.length === 0) {
    return body;
  }

  let replacedBody = '';
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) {
      continue;
    }
    replacedBody += body.slice(cursor, match.start);
    const replacement = await resolver.resolve(match.url);
    replacedBody += replacement ?? match.raw;
    cursor = match.end;
  }
  return replacedBody + body.slice(cursor);
}

async function replaceReviewCommentImages(
  comment: PrReviewComment,
  resolver: PrImageReferenceResolver,
): Promise<PrReviewComment> {
  return {
    ...comment,
    body: await replaceImageReferences(comment.body, resolver),
  };
}

async function replaceReviewCommentsImages(
  comments: readonly PrReviewComment[],
  resolver: PrImageReferenceResolver,
): Promise<PrReviewComment[]> {
  let normalizedComments: PrReviewComment[] = [];
  for (const comment of comments) {
    normalizedComments = [...normalizedComments, await replaceReviewCommentImages(comment, resolver)];
  }
  return normalizedComments;
}

export async function resolvePrReviewTaskInput(cwd: string, prReview: PrReviewData): Promise<PrReviewTaskInput> {
  const resolver = createPrImageReferenceResolver(cwd);
  try {
    const normalizedPrReview: PrReviewData = {
      ...prReview,
      body: await replaceImageReferences(prReview.body, resolver),
      comments: await replaceReviewCommentsImages(prReview.comments, resolver),
      reviews: await replaceReviewCommentsImages(prReview.reviews, resolver),
    };

    const attachments = resolver.listAttachments();
    return {
      task: formatPrReviewAsTask(normalizedPrReview),
      ...(attachments.length > 0 ? { attachments, cleanupAttachments: resolver.cleanup } : {}),
    };
  } catch (error) {
    resolver.cleanup();
    throw error;
  }
}
