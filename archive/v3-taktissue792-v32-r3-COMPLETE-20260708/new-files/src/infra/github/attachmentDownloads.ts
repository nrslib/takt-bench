import { execFileSync } from 'node:child_process';
import * as https from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import type { PrImageAttachmentDownload } from '../git/types.js';
import {
  assertImageMimeMatchesBytes,
  MAX_IMAGE_ATTACHMENT_BYTES,
  parseImageContentType,
} from '../../shared/utils/imageMime.js';

const MAX_GITHUB_ATTACHMENT_REDIRECTS = 5;
const GITHUB_ATTACHMENT_DOWNLOAD_TIMEOUT_MS = 30_000;

export interface FetchGitHubBinaryRequest {
  url: string;
  headers: Record<string, string>;
  maxBytes: number;
  timeoutMs: number;
}

export interface FetchGitHubBinaryResult {
  data: Buffer;
  contentType: PrImageAttachmentDownload['contentType'];
}

export type FetchGitHubBinary = (request: FetchGitHubBinaryRequest) => Promise<FetchGitHubBinaryResult>;
export type GetGitHubAuthToken = (cwd: string) => string;

export interface DownloadGitHubImageAttachmentOptions {
  url: string;
  cwd: string;
  getAuthToken?: GetGitHubAuthToken;
  fetchBinary?: FetchGitHubBinary;
}

function getHeaderValue(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function sanitizeGitHubAttachmentUrlForError(rawUrl: string): string {
  try {
    const parsedUrl = new URL(rawUrl);
    return `${parsedUrl.origin}${parsedUrl.pathname}`;
  } catch {
    return rawUrl;
  }
}

function resolveRedirectUrl(currentUrl: string, location: string): string {
  const nextUrl = new URL(location, currentUrl);
  if (nextUrl.protocol !== 'https:') {
    throw new Error(`GitHub attachment redirect must use HTTPS: ${sanitizeGitHubAttachmentUrlForError(nextUrl.toString())}`);
  }
  return nextUrl.toString();
}

export function buildRedirectedGitHubAttachmentRequest(
  request: FetchGitHubBinaryRequest,
  location: string,
): FetchGitHubBinaryRequest {
  const nextUrl = resolveRedirectUrl(request.url, location);
  assertAllowedGitHubAttachmentUrl(nextUrl);
  return {
    ...request,
    url: nextUrl,
  };
}

async function fetchBinaryOverHttps(
  request: FetchGitHubBinaryRequest,
  redirectCount = 0,
): Promise<FetchGitHubBinaryResult> {
  if (redirectCount > MAX_GITHUB_ATTACHMENT_REDIRECTS) {
    throw new Error(`GitHub attachment redirect limit exceeded: ${sanitizeGitHubAttachmentUrlForError(request.url)}`);
  }

  return new Promise((resolve, reject) => {
    const req = https.get(request.url, { headers: request.headers }, (res) => {
      res.on('error', reject);
      const statusCode = res.statusCode;
      if (statusCode === undefined) {
        res.resume();
        reject(new Error(`GitHub attachment response missing HTTP status: ${sanitizeGitHubAttachmentUrlForError(request.url)}`));
        return;
      }

      if (statusCode >= 300 && statusCode < 400) {
        const location = getHeaderValue(res.headers, 'location');
        res.resume();
        if (location === undefined) {
          reject(new Error(`GitHub attachment redirect missing Location: ${sanitizeGitHubAttachmentUrlForError(request.url)}`));
          return;
        }
        let redirectedRequest: FetchGitHubBinaryRequest;
        try {
          redirectedRequest = buildRedirectedGitHubAttachmentRequest(request, location);
        } catch (error) {
          reject(error);
          return;
        }
        fetchBinaryOverHttps(redirectedRequest, redirectCount + 1).then(resolve, reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        res.resume();
        reject(new Error(`GitHub attachment download failed with HTTP status ${statusCode}: ${sanitizeGitHubAttachmentUrlForError(request.url)}`));
        return;
      }

      let contentType: PrImageAttachmentDownload['contentType'];
      try {
        contentType = parseImageContentType(getHeaderValue(res.headers, 'content-type'));
      } catch (error) {
        res.resume();
        reject(error);
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      res.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > request.maxBytes) {
          req.destroy(new Error(`GitHub image attachment exceeds the ${request.maxBytes} byte limit.`));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        resolve({
          data: Buffer.concat(chunks),
          contentType,
        });
      });
    });
    req.setTimeout(request.timeoutMs, () => {
      req.destroy(new Error(`GitHub attachment download timed out: ${sanitizeGitHubAttachmentUrlForError(request.url)}`));
    });
    req.on('error', reject);
  });
}

function isAllowedParsedGitHubAttachmentUrl(url: URL): boolean {
  if (url.protocol !== 'https:') {
    return false;
  }
  if (url.hostname === 'private-user-images.githubusercontent.com') {
    return true;
  }
  if (url.hostname !== 'github.com') {
    return false;
  }

  const pathSegments = url.pathname.split('/').filter((segment) => segment.length > 0);
  if (pathSegments[0] === 'user-attachments' && pathSegments[1] === 'assets' && pathSegments.length >= 3) {
    return true;
  }
  return pathSegments.length >= 4 && pathSegments[2] === 'assets';
}

export function isAllowedGitHubAttachmentUrl(rawUrl: string): boolean {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return false;
  }
  return isAllowedParsedGitHubAttachmentUrl(parsedUrl);
}

function assertAllowedGitHubAttachmentUrl(rawUrl: string): void {
  if (!isAllowedGitHubAttachmentUrl(rawUrl)) {
    throw new Error(`Unsupported GitHub attachment URL: ${sanitizeGitHubAttachmentUrlForError(rawUrl)}`);
  }
}

function getAuthTokenFromGh(cwd: string): string {
  const token = execFileSync('gh', ['auth', 'token'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  if (token.length === 0) {
    throw new Error('GitHub auth token is empty.');
  }
  return token;
}

export async function downloadGitHubImageAttachment(
  options: DownloadGitHubImageAttachmentOptions,
): Promise<PrImageAttachmentDownload> {
  assertAllowedGitHubAttachmentUrl(options.url);
  const getAuthToken = options.getAuthToken ?? getAuthTokenFromGh;
  const fetchBinary = options.fetchBinary ?? fetchBinaryOverHttps;
  const token = getAuthToken(options.cwd);
  const response = await fetchBinary({
    url: options.url,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'image/png,image/jpeg,image/gif,image/webp',
    },
    maxBytes: MAX_IMAGE_ATTACHMENT_BYTES,
    timeoutMs: GITHUB_ATTACHMENT_DOWNLOAD_TIMEOUT_MS,
  });

  if (response.data.length > MAX_IMAGE_ATTACHMENT_BYTES) {
    throw new Error(`GitHub image attachment exceeds the ${MAX_IMAGE_ATTACHMENT_BYTES} byte limit.`);
  }

  assertImageMimeMatchesBytes(response.contentType, response.data);

  return {
    data: response.data,
    contentType: response.contentType,
  };
}
