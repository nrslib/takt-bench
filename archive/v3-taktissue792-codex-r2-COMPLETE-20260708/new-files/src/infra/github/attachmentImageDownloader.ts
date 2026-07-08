import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import type { ClientRequest, IncomingMessage } from 'node:http';
import * as https from 'node:https';
import {
  formatSafeGithubAttachmentUrlForError,
  isAllowedGithubAttachmentUrl,
} from './attachmentImageUrlPolicy.js';

export interface DownloadedGithubAttachmentImage {
  body: Buffer;
  contentType: string;
  finalUrl: string;
}

export interface GithubAttachmentImageDownloadOptions {
  cwd?: string;
  maxBytes: number;
}

export type GithubAttachmentImageDownloader = (
  url: string,
  options: GithubAttachmentImageDownloadOptions,
) => Promise<DownloadedGithubAttachmentImage>;

export type GithubAttachmentHttpsGet = (
  url: string,
  options: https.RequestOptions,
  callback: (response: IncomingMessage) => void,
) => ClientRequest;

export interface GithubAttachmentImageDownloaderDependencies {
  getAuthToken: (cwd?: string) => string;
  httpsGet: GithubAttachmentHttpsGet;
}

const MAX_GITHUB_ATTACHMENT_REDIRECTS = 5;

function getGithubAuthToken(cwd?: string): string {
  const options: ExecFileSyncOptionsWithStringEncoding = {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  };
  if (cwd !== undefined) {
    options.cwd = cwd;
  }
  return execFileSync('gh', ['auth', 'token'], options).trim();
}

function getHeaderValue(header: string | string[] | undefined): string | undefined {
  if (typeof header === 'string') {
    return header;
  }
  if (Array.isArray(header) && header.length === 1) {
    return header[0];
  }
  return undefined;
}

function rejectWithSafeUrl(message: string, url: string): Error {
  return new Error(`${message}: ${formatSafeGithubAttachmentUrlForError(url)}`);
}

async function requestGithubAttachmentImage(
  url: string,
  token: string,
  maxBytes: number,
  redirectsRemaining: number,
  httpsGet: GithubAttachmentHttpsGet,
): Promise<DownloadedGithubAttachmentImage> {
  if (!isAllowedGithubAttachmentUrl(url)) {
    throw rejectWithSafeUrl('PR image URL is not an allowed GitHub attachment URL', url);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: Error): void => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    const request = httpsGet(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'takt-pr-review-image-attachments',
      },
    }, (response) => {
      const statusCode = response.statusCode;
      const location = getHeaderValue(response.headers.location);
      if (
        statusCode !== undefined
        && statusCode >= 300
        && statusCode < 400
        && location !== undefined
      ) {
        response.resume();
        if (redirectsRemaining <= 0) {
          fail(rejectWithSafeUrl('Too many redirects while downloading PR image', url));
          return;
        }
        const redirectUrl = new URL(location, url).toString();
        requestGithubAttachmentImage(redirectUrl, token, maxBytes, redirectsRemaining - 1, httpsGet)
          .then(resolve, fail);
        return;
      }
      if (statusCode === undefined) {
        response.resume();
        fail(rejectWithSafeUrl('Missing HTTP status code while downloading PR image', url));
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        fail(new Error(`Failed to download PR image ${formatSafeGithubAttachmentUrlForError(url)}: HTTP ${statusCode}`));
        return;
      }

      const contentType = getHeaderValue(response.headers['content-type']);
      if (contentType === undefined || contentType.trim().length === 0) {
        response.resume();
        fail(rejectWithSafeUrl('Missing Content-Type for PR image', url));
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      response.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          fail(new Error(`PR image exceeds the ${maxBytes} byte limit: ${formatSafeGithubAttachmentUrlForError(url)}`));
          response.destroy();
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve({
          body: Buffer.concat(chunks),
          contentType,
          finalUrl: url,
        });
      });
    });
    request.on('error', (_error) => {
      fail(rejectWithSafeUrl('Network error while downloading PR image', url));
    });
  });
}

export function createGithubAttachmentImageDownloader(
  dependencies: GithubAttachmentImageDownloaderDependencies,
): GithubAttachmentImageDownloader {
  return async (url, options) => {
    const token = dependencies.getAuthToken(options.cwd);
    if (token.length === 0) {
      throw new Error('gh auth token returned an empty token.');
    }
    return requestGithubAttachmentImage(
      url,
      token,
      options.maxBytes,
      MAX_GITHUB_ATTACHMENT_REDIRECTS,
      dependencies.httpsGet,
    );
  };
}

export const downloadGithubAttachmentImage = createGithubAttachmentImageDownloader({
  getAuthToken: getGithubAuthToken,
  httpsGet: https.get,
});
