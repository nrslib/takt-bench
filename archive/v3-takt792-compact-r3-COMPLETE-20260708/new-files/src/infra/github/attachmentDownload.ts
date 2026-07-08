import { execFileSync } from 'node:child_process';
import {
  inferImageMimeTypeFromMagicBytes,
  isSupportedImageMimeType,
  type SupportedImageMimeType,
} from '../../shared/utils/imageMime.js';

export const MAX_GITHUB_ATTACHMENT_IMAGE_BYTES = 10 * 1024 * 1024;

const GITHUB_HOST = 'github.com';
const USER_ATTACHMENTS_OWNER = 'user-attachments';
const ASSETS_SEGMENT = 'assets';
const GITHUB_IMAGE_ATTACHMENT_HOSTS = new Set([
  'user-images.githubusercontent.com',
  'private-user-images.githubusercontent.com',
]);

export interface DownloadedGitHubAttachmentImage {
  data: Buffer;
  mimeType: SupportedImageMimeType;
}

export function isGitHubAttachmentUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') {
    return false;
  }
  if (GITHUB_IMAGE_ATTACHMENT_HOSTS.has(url.hostname)) {
    return url.pathname.length > 1;
  }
  if (url.hostname !== GITHUB_HOST) {
    return false;
  }

  const segments = url.pathname.split('/').filter((segment) => segment.length > 0);
  if (segments[0] === USER_ATTACHMENTS_OWNER) {
    return segments[1] === ASSETS_SEGMENT && segments.length >= 3;
  }
  return segments.length >= 4 && segments[2] === ASSETS_SEGMENT;
}

function normalizeContentType(value: string | null): string {
  if (value === null) {
    throw new Error('Missing GitHub attachment image Content-Type.');
  }
  return value.split(';')[0]!.trim().toLowerCase();
}

function validateContentLength(value: string | null): void {
  if (value === null) {
    return;
  }

  const normalizedValue = value.trim();
  if (!/^[0-9]+$/.test(normalizedValue)) {
    throw new Error(`Invalid GitHub attachment image Content-Length: ${value}`);
  }

  const contentLength = Number.parseInt(normalizedValue, 10);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    throw new Error(`Invalid GitHub attachment image Content-Length: ${value}`);
  }
  if (contentLength > MAX_GITHUB_ATTACHMENT_IMAGE_BYTES) {
    throw new Error('GitHub attachment image exceeds the size limit.');
  }
}

function readGitHubAuthToken(cwd: string): string {
  const token = execFileSync(
    'gh',
    ['auth', 'token', '--hostname', GITHUB_HOST],
    { cwd, encoding: 'utf-8' },
  ).trim();
  if (token.length === 0) {
    throw new Error('GitHub authentication token is empty.');
  }
  return token;
}

function validateDownloadedImage(data: Buffer, contentType: string): SupportedImageMimeType {
  if (!isSupportedImageMimeType(contentType)) {
    throw new Error(`Unsupported GitHub attachment image Content-Type: ${contentType}`);
  }
  if (data.length > MAX_GITHUB_ATTACHMENT_IMAGE_BYTES) {
    throw new Error('GitHub attachment image exceeds the size limit.');
  }

  const inferredMimeType = inferImageMimeTypeFromMagicBytes(data);
  if (inferredMimeType === null) {
    throw new Error('Downloaded GitHub attachment image has unsupported magic bytes.');
  }
  if (inferredMimeType !== contentType) {
    throw new Error('Downloaded image MIME does not match Content-Type.');
  }
  return inferredMimeType;
}

async function readResponseBodyWithLimit(response: Response): Promise<Buffer> {
  if (response.body === null) {
    throw new Error('GitHub attachment image response body is missing.');
  }

  const reader = response.body.getReader();
  let chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        return Buffer.concat(chunks, totalBytes);
      }

      const chunk = Buffer.from(result.value);
      totalBytes += chunk.length;
      if (totalBytes > MAX_GITHUB_ATTACHMENT_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error('GitHub attachment image exceeds the size limit.');
      }
      chunks = [...chunks, chunk];
    }
  } finally {
    reader.releaseLock();
  }
}

export async function downloadGitHubAttachmentImage(
  url: string,
  cwd: string,
): Promise<DownloadedGitHubAttachmentImage> {
  if (!isGitHubAttachmentUrl(url)) {
    throw new Error(`Unsupported GitHub attachment URL: ${url}`);
  }

  const token = readGitHubAuthToken(cwd);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to download GitHub attachment image: HTTP ${response.status}`);
  }

  const contentType = normalizeContentType(response.headers.get('content-type'));
  validateContentLength(response.headers.get('content-length'));

  const data = await readResponseBodyWithLimit(response);
  const mimeType = validateDownloadedImage(data, contentType);
  return { data, mimeType };
}
