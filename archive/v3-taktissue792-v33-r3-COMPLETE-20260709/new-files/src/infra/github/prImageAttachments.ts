import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  DownloadedPrImageAttachments,
  PrImageAttachmentDownloadOptions,
  PrImageReference,
} from '../git/types.js';
import {
  MAX_IMAGE_ATTACHMENT_BYTES,
  validateImageAttachmentData,
} from '../../shared/utils/imageAttachmentData.js';

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const MAX_PR_IMAGE_REDIRECTS = 5;

function getGithubAuthToken(cwd: string | undefined): string {
  const token = execFileSync('gh', ['auth', 'token'], {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  if (token.length === 0) {
    throw new Error('GitHub authentication token is empty.');
  }
  return token;
}

function assertAllowedPrImageUrl(url: string): void {
  if (!isAllowedPrImageAttachmentUrl(url)) {
    throw new Error(`Unsupported PR image attachment URL: ${url}`);
  }
}

export function isAllowedPrImageAttachmentUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') {
    return false;
  }

  if (parsed.hostname === 'private-user-images.githubusercontent.com') {
    return parsed.pathname.length > 1;
  }

  if (parsed.hostname !== 'github.com') {
    return false;
  }

  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
  return (
    segments.length >= 3
    && segments[0] === 'user-attachments'
    && segments[1] === 'assets'
  ) || (
    segments.length >= 3
    && segments[2] === 'assets'
  );
}

function assertContentLengthWithinLimit(contentLength: string | null): void {
  if (contentLength === null) {
    return;
  }
  const parsed = Number.parseInt(contentLength, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid PR image attachment Content-Length: ${contentLength}`);
  }
  if (parsed > MAX_IMAGE_ATTACHMENT_BYTES) {
    throw new Error(`PR image attachment exceeds the ${MAX_IMAGE_ATTACHMENT_BYTES} byte limit.`);
  }
}

function createAttachmentSession(tmpRoot: string): { attachmentDir: string; sessionDir: string } {
  const taktTmpDir = path.join(tmpRoot, 'takt');
  fs.mkdirSync(taktTmpDir, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  fs.chmodSync(taktTmpDir, PRIVATE_DIRECTORY_MODE);
  const sessionDir = fs.mkdtempSync(path.join(taktTmpDir, 'pr-images-'));
  try {
    fs.chmodSync(sessionDir, PRIVATE_DIRECTORY_MODE);
    const attachmentDir = path.join(sessionDir, 'attachments');
    fs.mkdirSync(attachmentDir, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
    fs.chmodSync(attachmentDir, PRIVATE_DIRECTORY_MODE);
    return { attachmentDir, sessionDir };
  } catch (error) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    throw error;
  }
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function resolveRedirectUrl(currentUrl: string, location: string | null): string {
  if (location === null) {
    throw new Error('PR image attachment redirect Location is required.');
  }
  return new URL(location, currentUrl).toString();
}

async function cancelResponseBody(response: Response): Promise<void> {
  await response.body?.cancel();
}

async function fetchAllowedPrImageResponse(url: string, token: string): Promise<Response> {
  let currentUrl = url;
  for (let redirectCount = 0; redirectCount <= MAX_PR_IMAGE_REDIRECTS; redirectCount += 1) {
    assertAllowedPrImageUrl(currentUrl);
    const response = await fetch(currentUrl, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'manual',
    });
    if (!isRedirectStatus(response.status)) {
      return response;
    }
    const location = response.headers.get('location');
    await cancelResponseBody(response);
    const nextUrl = resolveRedirectUrl(currentUrl, location);
    assertAllowedPrImageUrl(nextUrl);
    currentUrl = nextUrl;
  }
  throw new Error(`PR image attachment exceeded ${MAX_PR_IMAGE_REDIRECTS} redirects.`);
}

async function readResponseBodyWithinLimit(response: Response): Promise<Buffer> {
  if (response.body === null) {
    throw new Error('PR image attachment response body stream is required.');
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return Buffer.concat(chunks, totalBytes);
      }
      totalBytes += value.byteLength;
      if (totalBytes > MAX_IMAGE_ATTACHMENT_BYTES) {
        await reader.cancel();
        throw new Error(`PR image attachment exceeds the ${MAX_IMAGE_ATTACHMENT_BYTES} byte limit.`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
}

async function readImageResponse(url: string, token: string): Promise<{ data: Buffer; contentType: string }> {
  const response = await fetchAllowedPrImageResponse(url, token);
  if (!response.ok) {
    await cancelResponseBody(response);
    throw new Error(`Failed to download PR image attachment: HTTP ${response.status}`);
  }

  try {
    assertContentLengthWithinLimit(response.headers.get('content-length'));
  } catch (error) {
    await cancelResponseBody(response);
    throw error;
  }

  const contentType = response.headers.get('content-type');
  if (contentType === null) {
    await cancelResponseBody(response);
    throw new Error('PR image attachment Content-Type is required.');
  }
  const data = await readResponseBodyWithinLimit(response);
  return { data, contentType };
}

function writeAttachmentFile(
  reference: PrImageReference,
  data: Buffer,
  extension: string,
  attachmentDir: string,
  index: number,
): DownloadedPrImageAttachments['attachments'][number] {
  const fileName = `image-${index}${extension}`;
  const tempPath = path.join(attachmentDir, fileName);
  fs.writeFileSync(tempPath, data, { mode: PRIVATE_FILE_MODE, flag: 'wx' });
  return {
    placeholder: reference.placeholder,
    tempPath,
    fileName,
  };
}

export async function downloadPrImageAttachments(
  references: readonly PrImageReference[],
  options: PrImageAttachmentDownloadOptions,
): Promise<DownloadedPrImageAttachments> {
  for (const reference of references) {
    assertAllowedPrImageUrl(reference.url);
  }

  const token = getGithubAuthToken(options.cwd);
  const tmpRoot = options.tmpRoot ?? os.tmpdir();
  const session = createAttachmentSession(tmpRoot);
  const attachments: DownloadedPrImageAttachments['attachments'] = [];

  try {
    for (const [referenceIndex, reference] of references.entries()) {
      const { data, contentType } = await readImageResponse(reference.url, token);
      const imageInfo = validateImageAttachmentData({
        data,
        contentType,
        maxBytes: MAX_IMAGE_ATTACHMENT_BYTES,
      });
      attachments.push(writeAttachmentFile(reference, data, imageInfo.extension, session.attachmentDir, referenceIndex + 1));
    }
  } catch (error) {
    fs.rmSync(session.sessionDir, { recursive: true, force: true });
    throw error;
  }

  return {
    attachments,
    cleanupAttachments: () => {
      fs.rmSync(session.sessionDir, { recursive: true, force: true });
    },
  };
}
