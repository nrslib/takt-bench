import { execFileSync } from 'node:child_process';
import * as https from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import {
  assertImageMagicBytesMatch,
  MAX_IMAGE_ATTACHMENT_BYTES,
  normalizeImageContentType,
} from '../../shared/utils/imageMime.js';
import { getErrorMessage } from '../../shared/utils/index.js';

export interface GitHubAttachmentImageDownloadOptions {
  cwd: string;
  maxBytes: number;
  timeoutMs?: number;
  authToken?: string;
}

export interface GitHubAttachmentImageDownloadResult {
  body: Buffer;
  contentType: string;
  finalUrl?: string;
}

export type GitHubAttachmentImageDownloader = (
  url: string,
  options: GitHubAttachmentImageDownloadOptions,
) => Promise<GitHubAttachmentImageDownloadResult>;

export const GITHUB_ATTACHMENT_DOWNLOAD_TIMEOUT_MS = 30_000;

const MAX_GITHUB_ATTACHMENT_REDIRECTS = 5;
const GITHUB_ATTACHMENT_USER_AGENT = 'takt-cli';

function parseHttpsUrl(value: string): URL | undefined {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isGithubDotComAttachmentUrl(parsed: URL): boolean {
  if (parsed.hostname !== 'github.com') {
    return false;
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length >= 3 && segments[0] === 'user-attachments' && segments[1] === 'assets') {
    return true;
  }
  return segments.length >= 4 && segments[2] === 'assets';
}

export function isAllowedGitHubAttachmentImageUrl(url: string): boolean {
  const parsed = parseHttpsUrl(url);
  if (!parsed) {
    return false;
  }
  return isGithubDotComAttachmentUrl(parsed)
    || parsed.hostname === 'private-user-images.githubusercontent.com';
}

function isAllowedGitHubAttachmentRedirectUrl(url: string): boolean {
  const parsed = parseHttpsUrl(url);
  if (!parsed) {
    return false;
  }
  return isGithubDotComAttachmentUrl(parsed)
    || parsed.hostname === 'private-user-images.githubusercontent.com'
    || parsed.hostname === 'user-images.githubusercontent.com';
}

export function redactGitHubAttachmentUrl(url: string): string {
  const parsed = parseHttpsUrl(url);
  if (!parsed) {
    return '[invalid-url]';
  }
  return `${parsed.origin}${parsed.pathname}`;
}

function resolveMaxBytes(maxBytes: number): number {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error(`GitHub attachment maxBytes must be a positive safe integer: ${String(maxBytes)}`);
  }
  return maxBytes;
}

function resolveGithubAuthToken(cwd: string): string {
  try {
    return execFileSync('gh', ['auth', 'token'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw new Error(`Failed to resolve GitHub authentication token: ${getErrorMessage(error)}`);
  }
}

function readHeaderValue(headers: IncomingHttpHeaders, name: string): string {
  const value = headers[name];
  if (Array.isArray(value)) {
    const firstValue = value[0];
    if (firstValue) {
      return firstValue;
    }
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  throw new Error(`GitHub attachment response is missing ${name} header.`);
}

function readRedirectLocation(headers: IncomingHttpHeaders): string | undefined {
  const location = headers.location;
  return Array.isArray(location) ? location[0] : location;
}

function resolveRedirectUrl(currentUrl: string, location: string | undefined): string {
  if (!location) {
    throw new Error('GitHub attachment redirect is missing location header.');
  }
  return new URL(location, currentUrl).toString();
}

function shouldSendAuthorizationHeader(url: string): boolean {
  const parsed = parseHttpsUrl(url);
  return parsed?.hostname === 'github.com';
}

function buildRequestHeaders(url: string, token: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': GITHUB_ATTACHMENT_USER_AGENT,
  };
  if (shouldSendAuthorizationHeader(url)) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function requestGitHubAttachment(
  url: string,
  token: string,
  maxBytes: number,
  timeoutMs: number,
  redirectCount: number,
): Promise<GitHubAttachmentImageDownloadResult> {
  if (redirectCount > MAX_GITHUB_ATTACHMENT_REDIRECTS) {
    throw new Error(`GitHub attachment redirect limit exceeded for ${redactGitHubAttachmentUrl(url)}`);
  }
  if (!isAllowedGitHubAttachmentRedirectUrl(url)) {
    throw new Error(`Refusing to download non-GitHub attachment URL: ${redactGitHubAttachmentUrl(url)}`);
  }

  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      headers: buildRequestHeaders(url, token),
    }, (response) => {
      const statusCode = response.statusCode;
      if (statusCode === undefined) {
        response.resume();
        reject(new Error(
          `GitHub attachment response is missing HTTP status code: ${redactGitHubAttachmentUrl(url)}`,
        ));
        return;
      }

      if (statusCode >= 300 && statusCode < 400) {
        response.resume();
        let redirectUrl: string;
        try {
          redirectUrl = resolveRedirectUrl(url, readRedirectLocation(response.headers));
        } catch (error) {
          reject(error);
          return;
        }
        if (!isAllowedGitHubAttachmentRedirectUrl(redirectUrl)) {
          reject(new Error(
            `Refusing to follow non-GitHub attachment redirect: ${redactGitHubAttachmentUrl(redirectUrl)}`,
          ));
          return;
        }
        requestGitHubAttachment(redirectUrl, token, maxBytes, timeoutMs, redirectCount + 1).then(resolve, reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(
          `GitHub attachment download failed with HTTP status ${statusCode}: ${redactGitHubAttachmentUrl(url)}`,
        ));
        return;
      }

      let receivedBytes = 0;
      const chunks: Buffer[] = [];
      let settled = false;
      response.on('data', (chunk: Buffer | string) => {
        if (settled) {
          return;
        }
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        receivedBytes += buffer.length;
        if (receivedBytes > maxBytes) {
          settled = true;
          request.destroy(new Error(
            `PR image attachment exceeds the ${maxBytes} byte limit: ${redactGitHubAttachmentUrl(url)}`,
          ));
          return;
        }
        chunks.push(buffer);
      });
      response.on('end', () => {
        if (settled) {
          return;
        }
        try {
          const contentType = normalizeImageContentType(readHeaderValue(response.headers, 'content-type'));
          const body = Buffer.concat(chunks);
          assertImageMagicBytesMatch(body, contentType, 'PR image attachment');
          resolve({ body, contentType, finalUrl: url });
        } catch (error) {
          reject(error);
        }
      });
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(
        `GitHub attachment download timed out after ${timeoutMs}ms: ${redactGitHubAttachmentUrl(url)}`,
      ));
    });
    request.on('error', reject);
    request.end();
  });
}

export function createGitHubAttachmentImageDownloader(cwd: string): GitHubAttachmentImageDownloader {
  let token: string | undefined;
  const getToken = (): string => {
    if (token === undefined) {
      token = resolveGithubAuthToken(cwd);
      if (token.length === 0) {
        throw new Error('GitHub authentication token is empty.');
      }
    }
    return token;
  };

  return (url: string, options: GitHubAttachmentImageDownloadOptions) => {
    if (!isAllowedGitHubAttachmentImageUrl(url)) {
      return Promise.reject(
        new Error(`Refusing to download non-GitHub attachment URL: ${redactGitHubAttachmentUrl(url)}`),
      );
    }
    return downloadGitHubAttachmentImage(url, {
      ...options,
      cwd,
      authToken: getToken(),
    });
  };
}

export async function downloadGitHubAttachmentImage(
  url: string,
  options: GitHubAttachmentImageDownloadOptions,
): Promise<GitHubAttachmentImageDownloadResult> {
  const maxBytes = resolveMaxBytes(options.maxBytes ?? MAX_IMAGE_ATTACHMENT_BYTES);
  if (!isAllowedGitHubAttachmentImageUrl(url)) {
    throw new Error(`Refusing to download non-GitHub attachment URL: ${redactGitHubAttachmentUrl(url)}`);
  }
  const token = options.authToken ?? resolveGithubAuthToken(options.cwd);
  if (token.length === 0) {
    throw new Error('GitHub authentication token is empty.');
  }
  return requestGitHubAttachment(
    url,
    token,
    maxBytes,
    options.timeoutMs ?? GITHUB_ATTACHMENT_DOWNLOAD_TIMEOUT_MS,
    0,
  );
}
