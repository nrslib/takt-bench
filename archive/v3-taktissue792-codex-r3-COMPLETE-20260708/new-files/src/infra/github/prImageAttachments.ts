import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import type { IncomingHttpHeaders } from 'node:http';
import { request } from 'node:https';
import * as os from 'node:os';
import * as path from 'node:path';
import type { PrReviewComment, PrReviewData } from '../git/types.js';
import type { StoredImageAttachment } from '../../shared/types/image-attachments.js';
import {
  extensionForSupportedImageMimeType,
  inferSupportedImageMimeTypeFromMagicBytes,
  normalizeImageContentType,
  type SupportedImageMimeType,
} from '../../shared/utils/imageMime.js';

export const MAX_PR_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const PR_IMAGE_ATTACHMENT_DOWNLOAD_TIMEOUT_MS = 30_000;

const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const MAX_ATTACHMENT_REDIRECTS = 5;

interface ExtractedImageReference {
  raw: string;
  url: string;
  index: number;
}

interface DownloadedImage {
  data: Buffer;
  mimeType: SupportedImageMimeType;
}

export interface ResolvedPrReviewImageAttachments {
  prReview: PrReviewData;
  attachments: StoredImageAttachment[];
  cleanup: () => void;
}

function isGitHubAttachmentUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') {
    return false;
  }

  if (url.hostname === 'private-user-images.githubusercontent.com') {
    return true;
  }

  if (url.hostname !== 'github.com') {
    return false;
  }

  const segments = url.pathname.split('/').filter((segment) => segment.length > 0);
  if (segments[0] === 'user-attachments' && segments[1] === 'assets' && segments.length >= 3) {
    return true;
  }
  return segments.length >= 4 && segments[2] === 'assets';
}

function extractImageReferences(text: string): ExtractedImageReference[] {
  const references: ExtractedImageReference[] = [];
  const markdownImagePattern = /!\[[^\]\r\n]*\]\((\S+?)(?:\s+["'][^"']*["'])?\)/g;
  const htmlImagePattern = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi;

  for (const match of text.matchAll(markdownImagePattern)) {
    const raw = match[0];
    const url = match[1];
    if (url) {
      references.push({ raw, url, index: match.index ?? 0 });
    }
  }

  for (const match of text.matchAll(htmlImagePattern)) {
    const raw = match[0];
    const url = match[1] ?? match[2] ?? match[3];
    if (url) {
      references.push({ raw, url, index: match.index ?? 0 });
    }
  }

  return references.sort((left, right) => left.index - right.index);
}

function collectGitHubAttachmentUrls(prReview: PrReviewData): string[] {
  const orderedUrls: string[] = [];
  const seenUrls = new Set<string>();
  const collect = (text: string): void => {
    for (const reference of extractImageReferences(text)) {
      if (isGitHubAttachmentUrl(reference.url) && !seenUrls.has(reference.url)) {
        seenUrls.add(reference.url);
        orderedUrls.push(reference.url);
      }
    }
  };

  collect(prReview.body);
  for (const comment of prReview.comments) {
    collect(comment.body);
  }
  for (const review of prReview.reviews) {
    collect(review.body);
  }
  return orderedUrls;
}

function rewriteImageReferences(text: string, placeholderByUrl: Map<string, string>): string {
  const replacements = extractImageReferences(text)
    .filter((reference) => placeholderByUrl.has(reference.url))
    .sort((left, right) => right.index - left.index);
  let rewritten = text;
  for (const reference of replacements) {
    const placeholder = placeholderByUrl.get(reference.url);
    if (!placeholder) {
      throw new Error('Missing image placeholder for GitHub attachment.');
    }
    rewritten = `${rewritten.slice(0, reference.index)}${placeholder}${rewritten.slice(reference.index + reference.raw.length)}`;
  }
  return rewritten;
}

function rewriteReviewComment(
  comment: PrReviewComment,
  placeholderByUrl: Map<string, string>,
): PrReviewComment {
  return {
    ...comment,
    body: rewriteImageReferences(comment.body, placeholderByUrl),
  };
}

function rewritePrReview(prReview: PrReviewData, placeholderByUrl: Map<string, string>): PrReviewData {
  return {
    ...prReview,
    body: rewriteImageReferences(prReview.body, placeholderByUrl),
    comments: prReview.comments.map((comment) => rewriteReviewComment(comment, placeholderByUrl)),
    reviews: prReview.reviews.map((review) => rewriteReviewComment(review, placeholderByUrl)),
  };
}

function headersToMap(rawHeaders: IncomingHttpHeaders): Map<string, string> {
  const headers = new Map<string, string>();
  for (const [name, value] of Object.entries(rawHeaders)) {
    if (typeof value === 'string') {
      headers.set(name.toLowerCase(), value);
    } else if (Array.isArray(value) && value.length > 0) {
      headers.set(name.toLowerCase(), value.join(', '));
    }
  }
  return headers;
}

function parseContentLength(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const contentLength = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    throw new Error(`Invalid GitHub image Content-Length: ${value}`);
  }
  return contentLength;
}

function assertImageSizeWithinLimit(size: number): void {
  if (size > MAX_PR_IMAGE_ATTACHMENT_BYTES) {
    throw new Error(`GitHub image attachment exceeds the ${MAX_PR_IMAGE_ATTACHMENT_BYTES} byte limit.`);
  }
}

function validateDownloadedImage(headers: Map<string, string>, body: Buffer, imageLabel: string): DownloadedImage {
  const contentLength = parseContentLength(headers.get('content-length'));
  if (contentLength !== undefined) {
    assertImageSizeWithinLimit(contentLength);
  }
  assertImageSizeWithinLimit(body.length);

  const contentType = normalizeImageContentType(headers.get('content-type') ?? '');
  if (!contentType) {
    throw new Error(`Unsupported GitHub image Content-Type for ${imageLabel}: ${headers.get('content-type') ?? '(missing)'}`);
  }

  const magicBytesMimeType = inferSupportedImageMimeTypeFromMagicBytes(body);
  if (!magicBytesMimeType) {
    throw new Error(`Unsupported GitHub image magic bytes for ${imageLabel}. Expected PNG, JPEG, GIF, or WebP data.`);
  }
  if (contentType !== magicBytesMimeType) {
    throw new Error(`GitHub image Content-Type does not match magic bytes for ${imageLabel}: ${contentType} !== ${magicBytesMimeType}`);
  }

  return { data: body, mimeType: magicBytesMimeType };
}

function readGitHubAuthToken(cwd: string | undefined): string {
  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (token.length === 0) {
      throw new Error('empty token');
    }
    return token;
  } catch {
    throw new Error('Failed to read GitHub authentication token.');
  }
}

function resolveRedirectUrl(currentUrl: string, location: string | string[] | undefined, imageLabel: string): string {
  const rawLocation = Array.isArray(location) ? location[0] : location;
  if (!rawLocation) {
    throw new Error(`GitHub image redirect is missing Location for ${imageLabel}.`);
  }
  const redirectedUrl = new URL(rawLocation, currentUrl).toString();
  if (!isGitHubAttachmentUrl(redirectedUrl)) {
    throw new Error(`GitHub image redirect points outside allowed attachment hosts for ${imageLabel}.`);
  }
  return redirectedUrl;
}

async function requestGitHubAttachment(
  url: string,
  token: string,
  imageLabel: string,
  redirectCount: number,
): Promise<{ headers: Map<string, string>; body: Buffer }> {
  if (redirectCount > MAX_ATTACHMENT_REDIRECTS) {
    throw new Error(`GitHub image attachment exceeded redirect limit for ${imageLabel}.`);
  }

  return await new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = request({
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'image/png,image/jpeg,image/gif,image/webp',
        'user-agent': 'takt',
      },
    }, (response) => {
      const statusCode = response.statusCode ?? 0;
      if (statusCode >= 300 && statusCode < 400) {
        response.resume();
        let redirectedUrl: string;
        try {
          redirectedUrl = resolveRedirectUrl(url, response.headers.location, imageLabel);
        } catch (error) {
          reject(error);
          return;
        }
        requestGitHubAttachment(redirectedUrl, token, imageLabel, redirectCount + 1).then(resolve, reject);
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`GitHub image attachment request failed for ${imageLabel}: HTTP ${statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      let receivedBytes = 0;
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        receivedBytes += buffer.length;
        if (receivedBytes > MAX_PR_IMAGE_ATTACHMENT_BYTES) {
          req.destroy(new Error(`GitHub image attachment exceeds the ${MAX_PR_IMAGE_ATTACHMENT_BYTES} byte limit.`));
          return;
        }
        chunks.push(buffer);
      });
      response.on('end', () => {
        resolve({
          headers: headersToMap(response.headers),
          body: Buffer.concat(chunks),
        });
      });
      response.on('error', reject);
    });
    req.setTimeout(PR_IMAGE_ATTACHMENT_DOWNLOAD_TIMEOUT_MS, () => {
      req.destroy(new Error(`GitHub image attachment request timed out for ${imageLabel}.`));
    });
    req.on('error', reject);
    req.end();
  });
}

async function downloadImageWithAuthenticatedRequest(url: string, token: string, imageLabel: string): Promise<DownloadedImage> {
  try {
    const { headers, body } = await requestGitHubAttachment(url, token, imageLabel, 0);
    return validateDownloadedImage(headers, body, imageLabel);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('GitHub image attachment exceeds the ')) {
      throw error;
    }
    if (error instanceof Error && error.message.includes(` for ${imageLabel}`)) {
      throw error;
    }
    throw new Error(`Failed to download GitHub image attachment ${imageLabel}.`);
  }
}

function ensurePrivateDirectory(directory: string): void {
  fs.mkdirSync(directory, { recursive: true, mode: PRIVATE_DIR_MODE });
  fs.chmodSync(directory, PRIVATE_DIR_MODE);
}

export async function resolvePrReviewImageAttachments(
  prReview: PrReviewData,
  cwd?: string,
): Promise<ResolvedPrReviewImageAttachments> {
  const urls = collectGitHubAttachmentUrls(prReview);
  if (urls.length === 0) {
    return {
      prReview: rewritePrReview(prReview, new Map()),
      attachments: [],
      cleanup: () => undefined,
    };
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'takt-pr-images-'));
  const attachmentDir = path.join(tempRoot, 'attachments');
  try {
    ensurePrivateDirectory(tempRoot);
    ensurePrivateDirectory(attachmentDir);
    const githubToken = readGitHubAuthToken(cwd);

    const attachments: StoredImageAttachment[] = [];
    const placeholderByUrl = new Map<string, string>();
    for (const url of urls) {
      const index = attachments.length + 1;
      const imageLabel = `Image #${index}`;
      const downloaded = await downloadImageWithAuthenticatedRequest(url, githubToken, imageLabel);
      const fileName = `image-${index}.${extensionForSupportedImageMimeType(downloaded.mimeType)}`;
      const tempPath = path.join(attachmentDir, fileName);
      fs.writeFileSync(tempPath, downloaded.data, { mode: PRIVATE_FILE_MODE, flag: 'wx' });
      const attachment: StoredImageAttachment = {
        placeholder: `[Image #${index}]`,
        tempPath,
        fileName,
      };
      attachments.push(attachment);
      placeholderByUrl.set(url, attachment.placeholder);
    }

    return {
      prReview: rewritePrReview(prReview, placeholderByUrl),
      attachments,
      cleanup: () => {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      },
    };
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}
