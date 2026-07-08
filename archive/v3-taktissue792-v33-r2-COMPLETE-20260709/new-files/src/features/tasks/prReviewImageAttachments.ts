import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  createGitHubAttachmentImageDownloader,
  isAllowedGitHubAttachmentImageUrl,
  redactGitHubAttachmentUrl,
  type GitHubAttachmentImageDownloadOptions,
  type GitHubAttachmentImageDownloadResult,
} from '../../infra/github/attachmentImage.js';
import type { PrReviewData, PrReviewComment } from '../../infra/git/index.js';
import {
  assertImageMagicBytesMatch,
  extensionForImageMimeType,
  MAX_IMAGE_ATTACHMENT_BYTES,
  normalizeImageContentType,
  type SupportedImageMimeType,
} from '../../shared/utils/imageMime.js';
import { getErrorMessage } from '../../shared/utils/index.js';
import { sanitizeSensitiveText } from '../../shared/utils/sensitiveText.js';
import type { TaskAttachment } from './attachments.js';

export type PrReviewImageAttachmentDownloadOptions = GitHubAttachmentImageDownloadOptions;
export type PrReviewImageAttachmentDownloadResult = GitHubAttachmentImageDownloadResult;

export type PrReviewImageAttachmentDownloader = (
  url: string,
  options: PrReviewImageAttachmentDownloadOptions,
) => Promise<PrReviewImageAttachmentDownloadResult>;

export interface ResolvePrReviewImageAttachmentsOptions {
  cwd?: string;
  tmpRoot?: string;
  downloader?: PrReviewImageAttachmentDownloader;
  maxBytes?: number;
  maxImages?: number;
  maxTotalBytes?: number;
}

export interface PrReviewImageAttachmentResult {
  prReview: PrReviewData;
  attachments: TaskAttachment[];
  failures: PrReviewImageAttachmentFailure[];
  cleanupAttachments?: () => void;
}

export type PrReviewImageAttachmentFailurePhase = 'download' | 'validation' | 'total_size' | 'image_count';

export interface PrReviewImageAttachmentFailure {
  url: string;
  phase: PrReviewImageAttachmentFailurePhase;
  reason: string;
}

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
export const MAX_PR_REVIEW_IMAGE_ATTACHMENTS = 20;
export const MAX_PR_REVIEW_IMAGE_ATTACHMENT_TOTAL_BYTES = 50 * 1024 * 1024;

function getMarkdownImageRegex(): RegExp {
  return /!\[[^\]]*]\((\S+?)(?:\s+["'][^"']*["'])?\)/g;
}

function getHtmlImageRegex(): RegExp {
  return /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi;
}

function getHttpsUrlRegex(): RegExp {
  return /https:\/\/[^\s<>"')]+/g;
}

function collectImageUrlsFromText(text: string): string[] {
  const urls: string[] = [];
  for (const match of text.matchAll(getMarkdownImageRegex())) {
    if (match[1]) {
      urls.push(match[1]);
    }
  }
  for (const match of text.matchAll(getHtmlImageRegex())) {
    const url = match[1] ?? match[2] ?? match[3];
    if (url) {
      urls.push(url);
    }
  }
  return urls;
}

function collectAllowedImageUrls(prReview: PrReviewData): string[] {
  const orderedUrls = [
    ...collectImageUrlsFromText(prReview.body),
    ...prReview.comments.flatMap((comment) => collectImageUrlsFromText(comment.body)),
    ...prReview.reviews.flatMap((review) => collectImageUrlsFromText(review.body)),
  ];
  const uniqueUrls: string[] = [];
  const seen = new Set<string>();
  for (const url of orderedUrls) {
    if (seen.has(url) || !isAllowedGitHubAttachmentImageUrl(url)) {
      continue;
    }
    seen.add(url);
    uniqueUrls.push(url);
  }
  return uniqueUrls;
}

function replaceImageReferencesInText(text: string, placeholdersByUrl: ReadonlyMap<string, string>): string {
  const markdownReplaced = text.replace(getMarkdownImageRegex(), (match: string, url: string) =>
    placeholdersByUrl.get(url) ?? match,
  );
  return markdownReplaced.replace(getHtmlImageRegex(), (
    match: string,
    doubleQuotedUrl: string | undefined,
    singleQuotedUrl: string | undefined,
    unquotedUrl: string | undefined,
  ) => {
    const url = doubleQuotedUrl ?? singleQuotedUrl ?? unquotedUrl;
    return url ? placeholdersByUrl.get(url) ?? match : match;
  });
}

function normalizePrReviewImageReferences(
  prReview: PrReviewData,
  placeholdersByUrl: ReadonlyMap<string, string>,
): PrReviewData {
  return {
    ...prReview,
    body: replaceImageReferencesInText(prReview.body, placeholdersByUrl),
    comments: prReview.comments.map((comment): PrReviewComment => ({
      ...comment,
      body: replaceImageReferencesInText(comment.body, placeholdersByUrl),
    })),
    reviews: prReview.reviews.map((review): PrReviewComment => ({
      ...review,
      body: replaceImageReferencesInText(review.body, placeholdersByUrl),
    })),
  };
}

function redactUrlsInErrorMessage(message: string): string {
  return sanitizeSensitiveText(message).replace(getHttpsUrlRegex(), (url) => redactGitHubAttachmentUrl(url));
}

function createImageAttachmentFailure(
  url: string,
  phase: PrReviewImageAttachmentFailurePhase,
  error: unknown,
): PrReviewImageAttachmentFailure {
  return {
    url: redactGitHubAttachmentUrl(url),
    phase,
    reason: redactUrlsInErrorMessage(getErrorMessage(error)),
  };
}

function appendPrImageAttachmentFailures(
  prReview: PrReviewData,
  failures: PrReviewImageAttachmentFailure[],
): PrReviewData {
  if (failures.length === 0) {
    return prReview;
  }
  const warningLines = [
    ...(prReview.body ? [prReview.body, ''] : []),
    '### PR Image Attachment Warnings',
    ...failures.map((failure) => `- ${failure.url}: ${failure.reason}`),
  ];
  return {
    ...prReview,
    body: warningLines.join('\n'),
  };
}

function ensurePrivateDirectory(directoryPath: string): void {
  fs.mkdirSync(directoryPath, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  fs.chmodSync(directoryPath, PRIVATE_DIRECTORY_MODE);
}

function createAttachmentTempStore(tmpRoot: string): {
  saveImage(data: Buffer, mimeType: SupportedImageMimeType): TaskAttachment;
  cleanupAttachments: () => void;
} {
  const sessionDir = path.join(tmpRoot, 'takt', `pr-review-images-${randomUUID()}`);
  const attachmentDir = path.join(sessionDir, 'attachments');
  let attachmentCount = 0;

  return {
    saveImage(data: Buffer, mimeType: SupportedImageMimeType): TaskAttachment {
      attachmentCount += 1;
      const fileName = `image-${attachmentCount}.${extensionForImageMimeType(mimeType, 'PR image attachment')}`;
      const tempPath = path.join(attachmentDir, fileName);
      ensurePrivateDirectory(sessionDir);
      ensurePrivateDirectory(attachmentDir);
      fs.writeFileSync(tempPath, data, { mode: PRIVATE_FILE_MODE, flag: 'wx' });
      return {
        placeholder: `[Image #${attachmentCount}]`,
        tempPath,
        fileName,
      };
    },
    cleanupAttachments(): void {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    },
  };
}

function resolveMaxBytes(maxBytes: number | undefined): number {
  const resolvedMaxBytes = maxBytes ?? MAX_IMAGE_ATTACHMENT_BYTES;
  if (!Number.isSafeInteger(resolvedMaxBytes) || resolvedMaxBytes <= 0) {
    throw new Error(`PR image attachment maxBytes must be a positive safe integer: ${String(maxBytes)}`);
  }
  return resolvedMaxBytes;
}

function resolveMaxImages(maxImages: number | undefined): number {
  const resolvedMaxImages = maxImages ?? MAX_PR_REVIEW_IMAGE_ATTACHMENTS;
  if (!Number.isSafeInteger(resolvedMaxImages) || resolvedMaxImages <= 0) {
    throw new Error(`PR image attachment maxImages must be a positive safe integer: ${String(maxImages)}`);
  }
  return resolvedMaxImages;
}

function resolveMaxTotalBytes(maxTotalBytes: number | undefined): number {
  const resolvedMaxTotalBytes = maxTotalBytes ?? MAX_PR_REVIEW_IMAGE_ATTACHMENT_TOTAL_BYTES;
  if (!Number.isSafeInteger(resolvedMaxTotalBytes) || resolvedMaxTotalBytes <= 0) {
    throw new Error(`PR image attachment maxTotalBytes must be a positive safe integer: ${String(maxTotalBytes)}`);
  }
  return resolvedMaxTotalBytes;
}

function requireCwdForPrImageDownload(cwd: string | undefined): string {
  if (!cwd) {
    throw new Error('cwd is required to download PR image attachments.');
  }
  return cwd;
}

function validateDownloadedImage(
  url: string,
  downloadResult: PrReviewImageAttachmentDownloadResult,
  maxBytes: number,
): SupportedImageMimeType {
  const contentType = normalizeImageContentType(downloadResult.contentType);
  if (downloadResult.body.length > maxBytes) {
    throw new Error(`PR image attachment exceeds the ${maxBytes} byte limit: ${redactGitHubAttachmentUrl(url)}`);
  }
  assertImageMagicBytesMatch(downloadResult.body, contentType, 'PR image attachment');
  return contentType;
}

export async function resolvePrReviewImageAttachments(
  prReview: PrReviewData,
  options: ResolvePrReviewImageAttachmentsOptions,
): Promise<PrReviewImageAttachmentResult> {
  const maxBytes = resolveMaxBytes(options.maxBytes);
  const maxImages = resolveMaxImages(options.maxImages);
  const maxTotalBytes = resolveMaxTotalBytes(options.maxTotalBytes);
  const allowedImageUrls = collectAllowedImageUrls(prReview);
  if (allowedImageUrls.length === 0) {
    return { prReview, attachments: [], failures: [] };
  }
  const imageUrls = allowedImageUrls.slice(0, maxImages);
  const skippedImageUrls = allowedImageUrls.slice(maxImages);
  const cwd = requireCwdForPrImageDownload(options.cwd);

  const store = createAttachmentTempStore(options.tmpRoot ?? os.tmpdir());
  const downloader = options.downloader ?? createGitHubAttachmentImageDownloader(cwd);
  const attachments: TaskAttachment[] = [];
  const failures: PrReviewImageAttachmentFailure[] = skippedImageUrls.map((url) => ({
    url: redactGitHubAttachmentUrl(url),
    phase: 'image_count',
    reason: `PR image attachment count limit exceeded: only the first ${maxImages} images are downloaded.`,
  }));
  const placeholdersByUrl = new Map<string, string>();
  let totalBytes = 0;

  for (const url of imageUrls) {
    let downloaded: PrReviewImageAttachmentDownloadResult;
    try {
      downloaded = await downloader(url, { cwd, maxBytes });
    } catch (error) {
      failures.push(createImageAttachmentFailure(url, 'download', error));
      continue;
    }

    let mimeType: SupportedImageMimeType;
    try {
      mimeType = validateDownloadedImage(url, downloaded, maxBytes);
    } catch (error) {
      failures.push(createImageAttachmentFailure(url, 'validation', error));
      continue;
    }

    if (totalBytes + downloaded.body.length > maxTotalBytes) {
      failures.push({
        url: redactGitHubAttachmentUrl(url),
        phase: 'total_size',
        reason: `PR image attachment total byte limit would exceed ${maxTotalBytes} bytes.`,
      });
      continue;
    }

    try {
      const attachment = store.saveImage(downloaded.body, mimeType);
      attachments.push(attachment);
      placeholdersByUrl.set(url, attachment.placeholder);
      totalBytes += downloaded.body.length;
    } catch (error) {
      store.cleanupAttachments();
      throw new Error(
        `Failed to save PR image attachment ${redactGitHubAttachmentUrl(url)}: ${redactUrlsInErrorMessage(getErrorMessage(error))}`,
      );
    }
  }

  const normalizedPrReview = normalizePrReviewImageReferences(prReview, placeholdersByUrl);
  return {
    prReview: appendPrImageAttachmentFailures(normalizedPrReview, failures),
    attachments,
    failures,
    cleanupAttachments: store.cleanupAttachments,
  };
}
