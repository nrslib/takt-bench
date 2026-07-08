import { execFileSync } from 'node:child_process';
import {
  MAX_IMAGE_ATTACHMENT_BYTES,
  normalizeImageContentType,
  validateImageDataMime,
  type SupportedImageMimeType,
} from '../../shared/utils/imageMime.js';
import { debugLog } from '../../shared/utils/index.js';

export interface DownloadedGitHubImageAttachment {
  data: Buffer;
  mimeType: SupportedImageMimeType;
  extension: string;
}

export type GitHubAttachmentFetch = (url: string, init: RequestInit) => Promise<Response>;
export type GitHubAttachmentAuthTokenResolver = (hostname: string, cwd: string) => string;

export interface DownloadGitHubImageAttachmentOptions {
  cwd: string;
  fetch?: GitHubAttachmentFetch;
  resolveAuthToken?: GitHubAttachmentAuthTokenResolver;
}

const MAX_GITHUB_ATTACHMENT_REDIRECTS = 5;
const GITHUB_HOSTNAME = 'github.com';
const USER_ATTACHMENTS_PATH_PREFIX = '/user-attachments/assets/';
const GITHUB_REPO_ASSETS_SEGMENT = 'assets';
const PRIVATE_USER_IMAGES_HOSTNAME = 'private-user-images.githubusercontent.com';
const USER_IMAGES_HOSTNAME = 'user-images.githubusercontent.com';

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hasGithubRepositoryAssetPath(pathname: string): boolean {
  const segments = pathname.split('/').filter((segment) => segment.length > 0);
  return segments.length >= 4 && segments[2] === GITHUB_REPO_ASSETS_SEGMENT;
}

export function isAllowedGitHubAttachmentUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (parsed === null || parsed.protocol !== 'https:') {
    return false;
  }

  if (parsed.hostname === GITHUB_HOSTNAME) {
    return parsed.pathname.startsWith(USER_ATTACHMENTS_PATH_PREFIX)
      || hasGithubRepositoryAssetPath(parsed.pathname);
  }

  return parsed.hostname === PRIVATE_USER_IMAGES_HOSTNAME
    || parsed.hostname === USER_IMAGES_HOSTNAME;
}

export function resolveGitHubAttachmentAuthToken(hostname: string, cwd: string): string {
  const token = execFileSync('gh', ['auth', 'token', '--hostname', hostname], {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  if (token.length === 0) {
    throw new Error(`GitHub auth token is empty for host: ${hostname}`);
  }
  return token;
}

function getAttachmentFetch(fetchOption: GitHubAttachmentFetch | undefined): GitHubAttachmentFetch {
  if (fetchOption !== undefined) {
    return fetchOption;
  }
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Global fetch is not available for GitHub attachment download.');
  }
  return (url, init) => globalThis.fetch(url, init);
}

function getResponseContentLength(response: Response): number | null {
  const value = response.headers.get('Content-Length');
  if (value === null) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid GitHub image attachment Content-Length: ${value}`);
  }
  return parsed;
}

function assertImageAttachmentWithinLimit(byteLength: number): void {
  if (byteLength > MAX_IMAGE_ATTACHMENT_BYTES) {
    throw new Error(`GitHub image attachment exceeds the ${MAX_IMAGE_ATTACHMENT_BYTES} byte limit.`);
  }
}

function resolveRedirectUrl(response: Response, currentUrl: string): string {
  const location = response.headers.get('Location');
  if (location === null || location.length === 0) {
    throw new Error(`GitHub image attachment redirect is missing Location: ${currentUrl}`);
  }
  return new URL(location, currentUrl).toString();
}

function isRedirectResponse(response: Response): boolean {
  return response.status >= 300 && response.status < 400;
}

async function cancelResponseBody(response: Response): Promise<void> {
  if (response.body === null) {
    return;
  }
  try {
    await response.body.cancel();
  } catch (error) {
    debugLog(
      'github',
      'Failed to cancel GitHub image attachment response body',
      error instanceof Error ? error.message : String(error),
    );
  }
}

function shouldSendAuthorizationToHost(hostname: string): boolean {
  return hostname === GITHUB_HOSTNAME;
}

function createRequestInitForUrl(
  url: string,
  token: string | undefined,
): RequestInit {
  const parsed = new URL(url);
  const headers = shouldSendAuthorizationToHost(parsed.hostname) && token !== undefined
    ? { authorization: `Bearer ${token}` }
    : undefined;
  return {
    redirect: 'manual',
    ...(headers !== undefined ? { headers } : {}),
  };
}

async function fetchGitHubAttachmentResponse(
  initialUrl: string,
  options: DownloadGitHubImageAttachmentOptions,
): Promise<Response> {
  const fetchAttachment = getAttachmentFetch(options.fetch);
  const resolveAuthToken = options.resolveAuthToken ?? resolveGitHubAttachmentAuthToken;
  let githubAuthToken: string | undefined;

  let currentUrl = initialUrl;
  for (let redirectCount = 0; redirectCount <= MAX_GITHUB_ATTACHMENT_REDIRECTS; redirectCount += 1) {
    const parsedCurrentUrl = new URL(currentUrl);
    if (shouldSendAuthorizationToHost(parsedCurrentUrl.hostname) && githubAuthToken === undefined) {
      githubAuthToken = resolveAuthToken(GITHUB_HOSTNAME, options.cwd);
    }

    const response = await fetchAttachment(currentUrl, createRequestInitForUrl(currentUrl, githubAuthToken));
    if (!isRedirectResponse(response)) {
      return response;
    }

    let redirectUrl: string;
    try {
      redirectUrl = resolveRedirectUrl(response, currentUrl);
    } finally {
      await cancelResponseBody(response);
    }
    if (!isAllowedGitHubAttachmentUrl(redirectUrl)) {
      throw new Error(`Unsupported GitHub attachment redirect URL: ${redirectUrl}`);
    }
    currentUrl = redirectUrl;
  }

  throw new Error(`GitHub image attachment exceeded ${MAX_GITHUB_ATTACHMENT_REDIRECTS} redirects: ${initialUrl}`);
}

async function readResponseBodyWithinLimit(response: Response): Promise<Buffer> {
  if (response.body === null) {
    const data = Buffer.from(await response.arrayBuffer());
    assertImageAttachmentWithinLimit(data.length);
    return data;
  }

  const reader = response.body.getReader();
  let totalLength = 0;
  let chunks: Buffer[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return Buffer.concat(chunks, totalLength);
    }
    if (value === undefined) {
      throw new Error('GitHub image attachment stream returned an empty chunk.');
    }

    totalLength += value.byteLength;
    if (totalLength > MAX_IMAGE_ATTACHMENT_BYTES) {
      await reader.cancel();
      throw new Error(`GitHub image attachment exceeds the ${MAX_IMAGE_ATTACHMENT_BYTES} byte limit.`);
    }
    chunks = [...chunks, Buffer.from(value)];
  }
}

export async function downloadGitHubImageAttachment(
  url: string,
  options: DownloadGitHubImageAttachmentOptions,
): Promise<DownloadedGitHubImageAttachment> {
  if (!isAllowedGitHubAttachmentUrl(url)) {
    throw new Error(`Unsupported GitHub attachment URL: ${url}`);
  }

  const response = await fetchGitHubAttachmentResponse(url, options);
  if (!response.ok) {
    await cancelResponseBody(response);
    throw new Error(`Failed to download GitHub image attachment: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('Content-Type');
  if (contentType === null || contentType.length === 0) {
    await cancelResponseBody(response);
    throw new Error('GitHub image attachment response is missing Content-Type.');
  }
  try {
    normalizeImageContentType(contentType);
  } catch (error) {
    await cancelResponseBody(response);
    throw error;
  }

  let contentLength: number | null;
  try {
    contentLength = getResponseContentLength(response);
  } catch (error) {
    await cancelResponseBody(response);
    throw error;
  }
  if (contentLength !== null) {
    try {
      assertImageAttachmentWithinLimit(contentLength);
    } catch (error) {
      await cancelResponseBody(response);
      throw error;
    }
  }

  const data = await readResponseBodyWithinLimit(response);
  return {
    data,
    ...validateImageDataMime(data, contentType),
  };
}
