import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { PrReviewData, PrReviewComment } from '../../infra/git/index.js';
import type { TaskAttachment } from './attachments.js';

const MAX_PR_REVIEW_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const PR_REVIEW_IMAGE_TEMP_PREFIX = 'takt-pr-review-images-';

type SupportedImageContentType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

interface DownloadImageOptions {
  headers: Record<string, string>;
  maxBytes: number;
}

interface DownloadedImage {
  body: Buffer;
  contentType: string;
  contentLength?: number;
}

interface ImageReference {
  start: number;
  end: number;
  url: string;
}

interface ResolvedImageAttachment {
  attachment: TaskAttachment;
  tempDir: string;
}

export interface ResolvePrReviewImageAttachmentsOptions {
  cwd?: string;
  getGithubToken?: () => string;
  downloadImage?: (url: string, options: DownloadImageOptions) => Promise<DownloadedImage>;
}

export interface ResolvedPrReviewImageAttachments {
  prReview: PrReviewData;
  attachments: TaskAttachment[];
  cleanupAttachments: () => void;
}

const CONTENT_TYPE_TO_EXTENSION: Record<SupportedImageContentType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

function getGithubTokenFromGh(cwd: string | undefined): string {
  const token = execFileSync('gh', ['auth', 'token'], {
    ...(cwd ? { cwd } : {}),
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  return requireGithubToken(token);
}

function requireGithubToken(token: string): string {
  if (!token) {
    throw new Error('GitHub auth token is empty');
  }
  return token;
}

async function defaultDownloadImage(url: string, options: DownloadImageOptions): Promise<DownloadedImage> {
  const response = await fetch(url, { headers: options.headers });
  if (!response.ok) {
    throw new Error(`Failed to download PR image attachment: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType) {
    throw new Error('PR image attachment Content-Type is required');
  }

  const contentLengthHeader = response.headers.get('content-length');
  const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : undefined;
  if (contentLength !== undefined && Number.isFinite(contentLength) && contentLength > options.maxBytes) {
    throw new Error(`PR image attachment exceeds size limit: ${contentLength} bytes`);
  }

  const body = await readResponseBodyWithLimit(response, options.maxBytes);
  return {
    body,
    contentType,
    ...(contentLength !== undefined && Number.isFinite(contentLength) ? { contentLength } : {}),
  };
}

async function readResponseBodyWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) {
    throw new Error('PR image attachment response body is required');
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const readResult = await reader.read();
      if (readResult.done) {
        return Buffer.concat(chunks, totalBytes);
      }

      const chunk = Buffer.from(readResult.value);
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel(`PR image attachment exceeds size limit: ${totalBytes} bytes`);
        throw new Error(`PR image attachment exceeds size limit: ${totalBytes} bytes`);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
}

function isAllowedGithubAttachmentUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') {
    return false;
  }

  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
  if (segments.length >= 3 && segments[0] === 'user-attachments' && segments[1] === 'assets') {
    return true;
  }
  return segments.length >= 4 && segments[2] === 'assets';
}

function normalizeContentType(contentType: string): SupportedImageContentType {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase();
  if (
    normalized === 'image/png'
    || normalized === 'image/jpeg'
    || normalized === 'image/gif'
    || normalized === 'image/webp'
  ) {
    return normalized;
  }
  throw new Error(`Unsupported PR image attachment Content-Type: ${contentType}`);
}

function hasMagicBytes(contentType: SupportedImageContentType, body: Buffer): boolean {
  switch (contentType) {
    case 'image/png':
      return body.length >= 8
        && body[0] === 0x89
        && body[1] === 0x50
        && body[2] === 0x4e
        && body[3] === 0x47
        && body[4] === 0x0d
        && body[5] === 0x0a
        && body[6] === 0x1a
        && body[7] === 0x0a;
    case 'image/jpeg':
      return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
    case 'image/gif':
      return body.subarray(0, 6).equals(Buffer.from('GIF87a', 'ascii'))
        || body.subarray(0, 6).equals(Buffer.from('GIF89a', 'ascii'));
    case 'image/webp':
      return body.length >= 12
        && body.subarray(0, 4).equals(Buffer.from('RIFF', 'ascii'))
        && body.subarray(8, 12).equals(Buffer.from('WEBP', 'ascii'));
  }
}

function validateDownloadedImage(image: DownloadedImage): SupportedImageContentType {
  if (image.contentLength !== undefined && image.contentLength > MAX_PR_REVIEW_IMAGE_ATTACHMENT_BYTES) {
    throw new Error(`PR image attachment exceeds size limit: ${image.contentLength} bytes`);
  }
  if (image.body.length > MAX_PR_REVIEW_IMAGE_ATTACHMENT_BYTES) {
    throw new Error(`PR image attachment exceeds size limit: ${image.body.length} bytes`);
  }

  const contentType = normalizeContentType(image.contentType);
  if (!hasMagicBytes(contentType, image.body)) {
    throw new Error(`PR image attachment magic bytes do not match Content-Type: ${image.contentType}`);
  }
  return contentType;
}

function createTempDirectory(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), PR_REVIEW_IMAGE_TEMP_PREFIX));
  fs.chmodSync(tempDir, 0o700);
  return tempDir;
}

function collectImageReferences(content: string): ImageReference[] {
  const references: ImageReference[] = [];
  const markdownImagePattern = /!\[[^\]\r\n]*\]\(([^)\s]+)(?:\s+["'][^)]*["'])?\)/g;
  const htmlImagePattern = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi;

  for (const match of content.matchAll(markdownImagePattern)) {
    const fullMatch = match[0];
    const url = match[1];
    if (match.index !== undefined && url) {
      references.push({ start: match.index, end: match.index + fullMatch.length, url });
    }
  }
  for (const match of content.matchAll(htmlImagePattern)) {
    const fullMatch = match[0];
    const url = match[1] ?? match[2] ?? match[3];
    if (match.index !== undefined && url) {
      references.push({ start: match.index, end: match.index + fullMatch.length, url });
    }
  }

  return references.sort((left, right) => left.start - right.start);
}

function cleanupTempDirs(tempDirs: Iterable<string>): void {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function resolvePrReviewImageAttachments(
  prReview: PrReviewData,
  options: ResolvePrReviewImageAttachmentsOptions,
): Promise<ResolvedPrReviewImageAttachments> {
  const downloadImage = options.downloadImage ?? defaultDownloadImage;
  const resolvedByUrl = new Map<string, ResolvedImageAttachment>();
  const tempDirs = new Set<string>();
  let githubToken: string | undefined;

  const getDownloadHeaders = (): Record<string, string> => {
    if (!githubToken) {
      const token = options.getGithubToken
        ? options.getGithubToken()
        : getGithubTokenFromGh(options.cwd);
      githubToken = requireGithubToken(token);
    }
    return { authorization: `Bearer ${githubToken}` };
  };

  const resolveAttachment = async (url: string): Promise<TaskAttachment | undefined> => {
    if (!isAllowedGithubAttachmentUrl(url)) {
      return undefined;
    }

    const existing = resolvedByUrl.get(url);
    if (existing) {
      return existing.attachment;
    }

    const image = await downloadImage(url, {
      headers: getDownloadHeaders(),
      maxBytes: MAX_PR_REVIEW_IMAGE_ATTACHMENT_BYTES,
    });
    const contentType = validateDownloadedImage(image);
    const index = resolvedByUrl.size + 1;
    const fileName = `image-${index}.${CONTENT_TYPE_TO_EXTENSION[contentType]}`;
    const tempDir = createTempDirectory();
    tempDirs.add(tempDir);
    const tempPath = path.join(tempDir, fileName);
    fs.writeFileSync(tempPath, image.body);

    const attachment = {
      placeholder: `[Image #${index}]`,
      tempPath,
      fileName,
    };
    resolvedByUrl.set(url, { attachment, tempDir });
    return attachment;
  };

  const replaceReferences = async (content: string): Promise<string> => {
    const references = collectImageReferences(content);
    if (references.length === 0) {
      return content;
    }

    let replaced = '';
    let cursor = 0;
    for (const reference of references) {
      if (reference.start < cursor) {
        continue;
      }
      replaced += content.slice(cursor, reference.start);
      const attachment = await resolveAttachment(reference.url);
      replaced += attachment?.placeholder ?? content.slice(reference.start, reference.end);
      cursor = reference.end;
    }
    return replaced + content.slice(cursor);
  };

  try {
    const body = await replaceReferences(prReview.body);
    const comments: PrReviewComment[] = [];
    for (const comment of prReview.comments) {
      comments.push({ ...comment, body: await replaceReferences(comment.body) });
    }
    const reviews: PrReviewComment[] = [];
    for (const review of prReview.reviews) {
      reviews.push({ ...review, body: await replaceReferences(review.body) });
    }

    const attachments = [...resolvedByUrl.values()].map((resolved) => resolved.attachment);
    return {
      prReview: {
        ...prReview,
        body,
        comments,
        reviews,
      },
      attachments,
      cleanupAttachments: () => cleanupTempDirs(tempDirs),
    };
  } catch (error) {
    cleanupTempDirs(tempDirs);
    throw error;
  }
}
