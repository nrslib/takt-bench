import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import type { IncomingMessage } from 'node:http';
import * as https from 'node:https';
import * as os from 'node:os';
import * as path from 'node:path';
import { formatPrReviewAsTask } from '../../infra/git/index.js';
import type { PrReviewComment, PrReviewData } from '../../infra/git/index.js';
import {
  assertSupportedImageContentType,
  extensionForImageMimeType,
  MAX_IMAGE_ATTACHMENT_BYTES,
  type SupportedImageMimeType,
} from '../../shared/utils/imageMime.js';
import type { TaskAttachment } from './attachments.js';

export interface DownloadedPrReviewImage {
  tempPath: string;
  mimeType: SupportedImageMimeType;
}

export interface PrReviewImageDownloadContext {
  cwd?: string;
  imageNumber: number;
}

export type PrReviewImageDownloader = (
  url: string,
  context: PrReviewImageDownloadContext,
) => Promise<DownloadedPrReviewImage>;

export interface PreparePrReviewTaskWithImageAttachmentsOptions {
  cwd?: string;
  prReview: PrReviewData;
  downloadImageAttachment?: PrReviewImageDownloader;
}

export interface PreparedPrReviewTaskWithImageAttachments {
  taskContent: string;
  attachments: TaskAttachment[];
  cleanupAttachments: () => void;
}

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const MAX_REDIRECTS = 5;
const MARKDOWN_IMAGE_PATTERN = String.raw`!\[[^\]\r\n]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)`;
const HTML_IMAGE_PATTERN = String.raw`<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>`;

function createImageReferencePattern(): RegExp {
  return new RegExp(`${MARKDOWN_IMAGE_PATTERN}|${HTML_IMAGE_PATTERN}`, 'gi');
}

function extractImageUrl(match: RegExpExecArray): string {
  const url = match[1] ?? match[2] ?? match[3] ?? match[4];
  if (!url) {
    throw new Error('Matched image reference without an image URL.');
  }
  return url;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isGithubDotComAttachmentUrl(url: URL): boolean {
  if (url.hostname !== 'github.com') {
    return false;
  }
  const segments = url.pathname.split('/').filter(Boolean);
  return (
    segments.length >= 3
    && segments[0] === 'user-attachments'
    && segments[1] === 'assets'
  ) || (
    segments.length >= 4
    && segments[2] === 'assets'
  );
}

function isGithubAttachmentUrl(value: string): boolean {
  const url = parseUrl(value);
  if (!url || url.protocol !== 'https:') {
    return false;
  }
  if (isGithubDotComAttachmentUrl(url)) {
    return true;
  }
  return url.hostname === 'user-images.githubusercontent.com'
    || url.hostname === 'private-user-images.githubusercontent.com';
}

function describeUnsupportedAttachmentUrl(value: string): string {
  const url = parseUrl(value);
  if (!url) {
    return 'Unsupported PR image attachment URL format.';
  }
  return `Unsupported PR image attachment URL host: ${url.hostname}`;
}

function shouldSendGithubToken(url: URL): boolean {
  return url.hostname === 'github.com'
    || url.hostname === 'api.github.com'
    || url.hostname.endsWith('.githubusercontent.com');
}

function getResponseHeader(response: IncomingMessage, name: string): string | undefined {
  const value = response.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function assertContentLengthWithinLimit(response: IncomingMessage): void {
  const contentLengthHeader = getResponseHeader(response, 'content-length');
  if (!contentLengthHeader) {
    return;
  }
  const contentLength = Number.parseInt(contentLengthHeader, 10);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    throw new Error(`Invalid image Content-Length: ${contentLengthHeader}`);
  }
  if (contentLength > MAX_IMAGE_ATTACHMENT_BYTES) {
    throw new Error(`PR image attachment exceeds the ${MAX_IMAGE_ATTACHMENT_BYTES} byte limit.`);
  }
}

function resolveRedirectUrl(currentUrl: URL, location: string): URL {
  const redirectUrl = new URL(location, currentUrl);
  if (redirectUrl.protocol !== 'https:') {
    throw new Error(`PR image attachment redirect must use HTTPS. Redirect protocol: ${redirectUrl.protocol}`);
  }
  if (!isGithubAttachmentUrl(redirectUrl.toString())) {
    throw new Error(`Unsupported PR image attachment redirect host: ${redirectUrl.hostname}`);
  }
  return redirectUrl;
}

function fetchImageData(currentUrl: URL, token: string, redirectsRemaining: number): Promise<{ data: Buffer; contentType: string | undefined }> {
  return new Promise((resolve, reject) => {
    const headers = shouldSendGithubToken(currentUrl)
      ? { Authorization: `Bearer ${token}` }
      : {};
    const request = https.get(currentUrl, { headers }, (response) => {
      const statusCode = response.statusCode;
      if (statusCode === undefined) {
        response.resume();
        reject(new Error(`PR image attachment download failed without an HTTP status from host: ${currentUrl.hostname}`));
        return;
      }
      if (statusCode >= 300 && statusCode < 400) {
        const location = getResponseHeader(response, 'location');
        response.resume();
        if (!location) {
          reject(new Error(`PR image attachment redirect is missing a Location header from host: ${currentUrl.hostname}`));
          return;
        }
        if (redirectsRemaining <= 0) {
          reject(new Error(`PR image attachment exceeded the ${MAX_REDIRECTS} redirect limit.`));
          return;
        }
        let redirectUrl: URL;
        try {
          redirectUrl = resolveRedirectUrl(currentUrl, location);
        } catch (error) {
          reject(error);
          return;
        }
        fetchImageData(redirectUrl, token, redirectsRemaining - 1).then(resolve, reject);
        return;
      }

      if (statusCode !== 200) {
        response.resume();
        reject(new Error(`PR image attachment download failed with HTTP ${statusCode} from host: ${currentUrl.hostname}`));
        return;
      }

      try {
        assertContentLengthWithinLimit(response);
      } catch (error) {
        response.resume();
        reject(error);
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      response.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_IMAGE_ATTACHMENT_BYTES) {
          request.destroy(new Error(`PR image attachment exceeds the ${MAX_IMAGE_ATTACHMENT_BYTES} byte limit.`));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        resolve({
          data: Buffer.concat(chunks),
          contentType: getResponseHeader(response, 'content-type'),
        });
      });
    });
    request.on('error', reject);
  });
}

function getGhAuthToken(cwd: string | undefined): string {
  const token = execFileSync('gh', ['auth', 'token'], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(cwd !== undefined ? { cwd } : {}),
  }).trim();
  if (token.length === 0) {
    throw new Error('gh auth token returned an empty token.');
  }
  return token;
}

function createGithubImageDownloader(): { downloadImageAttachment: PrReviewImageDownloader; cleanupAttachments: () => void } {
  let tempDir: string | undefined;
  const getTempDir = (): string => {
    if (tempDir === undefined) {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'takt-pr-images-'));
      fs.chmodSync(tempDir, PRIVATE_DIRECTORY_MODE);
    }
    return tempDir;
  };

  return {
    async downloadImageAttachment(urlValue, context): Promise<DownloadedPrReviewImage> {
      if (!isGithubAttachmentUrl(urlValue)) {
        throw new Error(describeUnsupportedAttachmentUrl(urlValue));
      }

      const token = getGhAuthToken(context.cwd);
      const url = new URL(urlValue);
      const { data, contentType } = await fetchImageData(url, token, MAX_REDIRECTS);
      const mimeType = assertSupportedImageContentType(contentType, data);
      const fileName = `image-${context.imageNumber}.${extensionForImageMimeType(mimeType)}`;
      const tempPath = path.join(getTempDir(), fileName);
      fs.writeFileSync(tempPath, data, { mode: PRIVATE_FILE_MODE, flag: 'wx' });
      return { tempPath, mimeType };
    },

    cleanupAttachments(): void {
      if (tempDir !== undefined) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    },
  };
}

function buildAttachment(imageNumber: number, downloaded: DownloadedPrReviewImage): TaskAttachment {
  return {
    placeholder: `[Image #${imageNumber}]`,
    tempPath: downloaded.tempPath,
    fileName: `image-${imageNumber}.${extensionForImageMimeType(downloaded.mimeType)}`,
  };
}

function clonePrReviewWithBody(prReview: PrReviewData, body: string): PrReviewData {
  return { ...prReview, body };
}

function cloneCommentWithBody(comment: PrReviewComment, body: string): PrReviewComment {
  return { ...comment, body };
}

export async function preparePrReviewTaskWithImageAttachments(
  options: PreparePrReviewTaskWithImageAttachmentsOptions,
): Promise<PreparedPrReviewTaskWithImageAttachments> {
  let downloadImageAttachment: PrReviewImageDownloader;
  let cleanupAttachments: () => void;
  if (options.downloadImageAttachment) {
    downloadImageAttachment = options.downloadImageAttachment;
    cleanupAttachments = () => undefined;
  } else {
    const defaultDownloader = createGithubImageDownloader();
    downloadImageAttachment = defaultDownloader.downloadImageAttachment;
    cleanupAttachments = defaultDownloader.cleanupAttachments;
  }
  const attachmentByUrl = new Map<string, TaskAttachment>();

  const resolvePlaceholder = async (url: string): Promise<string> => {
    const existing = attachmentByUrl.get(url);
    if (existing) {
      return existing.placeholder;
    }
    const imageNumber = attachmentByUrl.size + 1;
    const downloaded = await downloadImageAttachment(url, { cwd: options.cwd, imageNumber });
    const attachment = buildAttachment(imageNumber, downloaded);
    attachmentByUrl.set(url, attachment);
    return attachment.placeholder;
  };

  const replaceImageReferences = async (content: string): Promise<string> => {
    let replaced = '';
    let cursor = 0;
    for (const match of content.matchAll(createImageReferencePattern())) {
      const index = match.index;
      if (index === undefined) {
        continue;
      }
      const url = extractImageUrl(match);
      if (!isGithubAttachmentUrl(url)) {
        continue;
      }
      replaced += content.slice(cursor, index);
      replaced += await resolvePlaceholder(url);
      cursor = index + match[0].length;
    }
    return cursor === 0 ? content : replaced + content.slice(cursor);
  };

  try {
    const prReview = clonePrReviewWithBody(options.prReview, await replaceImageReferences(options.prReview.body));
    const comments: PrReviewComment[] = [];
    for (const comment of options.prReview.comments) {
      comments.push(cloneCommentWithBody(comment, await replaceImageReferences(comment.body)));
    }
    const reviews: PrReviewComment[] = [];
    for (const review of options.prReview.reviews) {
      reviews.push(cloneCommentWithBody(review, await replaceImageReferences(review.body)));
    }
    const rewrittenPrReview = { ...prReview, comments, reviews };
    return {
      taskContent: formatPrReviewAsTask(rewrittenPrReview),
      attachments: [...attachmentByUrl.values()],
      cleanupAttachments,
    };
  } catch (error) {
    cleanupAttachments();
    throw error;
  }
}
