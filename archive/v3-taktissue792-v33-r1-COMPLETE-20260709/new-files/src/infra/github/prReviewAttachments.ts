import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { StoredImageAttachment } from '../../shared/types/image-attachments.js';
import {
  MAX_IMAGE_ATTACHMENT_BYTES,
  validateImageAttachmentData,
  validateSupportedImageContentType,
} from '../../shared/utils/imageAttachmentData.js';
import type { PrReviewAttachmentResolution, PrReviewData } from '../git/types.js';
import {
  annotateFailedPrReviewImageReferences,
  extractPrReviewImageReferences,
  isGitHubPrImageAttachmentUrl,
  type PrReviewImageDownloadFailure,
  type PrReviewImageReference,
} from './prReviewImageReferences.js';
import {
  createPrReviewImageReferenceLimitMessage,
  createPrReviewImageTotalBytesLimitMessage,
  MAX_PR_REVIEW_IMAGE_ATTACHMENT_TOTAL_BYTES,
  MAX_PR_REVIEW_IMAGE_REFERENCES,
} from './prReviewAttachmentLimits.js';

const MAX_ATTACHMENT_REDIRECTS = 5;
const URL_IN_ERROR_MESSAGE_PATTERN = /https:\/\/[^\s)'"<>`]+/g;

export interface DownloadPrReviewAttachmentsOptions {
  references: readonly PrReviewImageReference[];
  tempRoot?: string;
  cwd?: string;
}

export interface DownloadedPrReviewAttachments {
  attachments: StoredImageAttachment[];
  failures: PrReviewImageDownloadFailure[];
  cleanupAttachments: () => void;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class PrReviewImageTotalBytesLimitError extends Error {
  constructor() {
    super(createPrReviewImageTotalBytesLimitMessage());
  }
}

class PrReviewImageReadLimitError extends Error {
  constructor(
    message: string,
    readonly consumedBytes: number,
    readonly totalLimitReached: boolean,
  ) {
    super(message);
  }
}

function resolveGhAuthToken(cwd: string | undefined): string {
  try {
    const token = String(execFileSync('gh', ['auth', 'token'], {
      ...(cwd ? { cwd } : {}),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })).trim();
    if (token.length === 0) {
      throw new Error('gh auth token returned an empty token.');
    }
    return token;
  } catch (error) {
    throw new Error(`Failed to resolve GitHub authentication token: ${getErrorMessage(error)}`);
  }
}

type RequestHeaders = Record<string, string>;

function createRequestHeaders(token: string): RequestHeaders {
  return { Authorization: `Bearer ${token}` };
}

function describeUrlForError(url: string): string {
  try {
    return `host ${new URL(url).hostname}`;
  } catch {
    return 'invalid URL';
  }
}

function sanitizeUrlForFailureReason(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return '[redacted-url]';
  }
}

function sanitizeFailureReason(reason: string): string {
  return reason.replace(URL_IN_ERROR_MESSAGE_PATTERN, (url) => sanitizeUrlForFailureReason(url));
}

function assertAllowedAttachmentUrl(url: string, subject: string): void {
  if (!isGitHubPrImageAttachmentUrl(url)) {
    throw new Error(`Unsupported PR image attachment ${subject}: ${describeUrlForError(url)}`);
  }
}

function getRequiredHeader(headers: Headers, name: string): string {
  const value = headers.get(name);
  if (!value) {
    throw new Error(`PR image attachment response is missing ${name}.`);
  }
  return value;
}

function getValidatedContentLength(headers: Headers): number | undefined {
  const contentLength = headers.get('content-length');
  if (!contentLength) {
    return undefined;
  }
  const parsed = Number.parseInt(contentLength, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid PR image attachment content-length: ${contentLength}`);
  }
  if (parsed > MAX_IMAGE_ATTACHMENT_BYTES) {
    throw new Error(`Image attachment exceeds ${MAX_IMAGE_ATTACHMENT_BYTES} bytes.`);
  }
  return parsed;
}

function assertRemainingTotalBytes(dataLength: number, remainingTotalBytes: number): void {
  if (dataLength > remainingTotalBytes) {
    throw new PrReviewImageTotalBytesLimitError();
  }
}

function createReadTotalBytesLimitError(consumedBytes: number): PrReviewImageReadLimitError {
  return new PrReviewImageReadLimitError(createPrReviewImageTotalBytesLimitMessage(), consumedBytes, true);
}

function createReadImageBytesLimitError(consumedBytes: number): PrReviewImageReadLimitError {
  return new PrReviewImageReadLimitError(
    `Image attachment exceeds ${MAX_IMAGE_ATTACHMENT_BYTES} bytes.`,
    consumedBytes,
    false,
  );
}

function createReadStreamError(error: unknown, consumedBytes: number, remainingTotalBytes: number): PrReviewImageReadLimitError {
  return new PrReviewImageReadLimitError(
    `Failed to read PR image attachment stream: ${getErrorMessage(error)}`,
    consumedBytes,
    consumedBytes >= remainingTotalBytes,
  );
}

function createCancelStreamError(error: unknown, readError: PrReviewImageReadLimitError): PrReviewImageReadLimitError {
  return new PrReviewImageReadLimitError(
    `${readError.message}; failed to cancel PR image attachment stream: ${getErrorMessage(error)}`,
    readError.consumedBytes,
    readError.totalLimitReached,
  );
}

async function throwAfterCancel(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  error: PrReviewImageReadLimitError,
): Promise<never> {
  try {
    await reader.cancel();
  } catch (cancelError) {
    throw createCancelStreamError(cancelError, error);
  }
  throw error;
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function resolveRedirectUrl(currentUrl: string, location: string): string {
  return new URL(location, currentUrl).toString();
}

async function fetchAllowedAttachmentResponse(url: string, headers: RequestHeaders): Promise<Response> {
  let currentUrl = url;
  for (let redirectCount = 0; redirectCount <= MAX_ATTACHMENT_REDIRECTS; redirectCount += 1) {
    assertAllowedAttachmentUrl(currentUrl, redirectCount === 0 ? 'URL' : 'redirect URL');
    const response = await fetch(currentUrl, {
      headers,
      redirect: 'manual',
    });
    if (!isRedirectStatus(response.status)) {
      return response;
    }

    const location = getRequiredHeader(response.headers, 'location');
    const redirectUrl = resolveRedirectUrl(currentUrl, location);
    assertAllowedAttachmentUrl(redirectUrl, 'redirect URL');
    currentUrl = redirectUrl;
  }

  throw new Error(`PR image attachment exceeded ${MAX_ATTACHMENT_REDIRECTS} redirects.`);
}

async function readResponseBodyWithinLimit(response: Response, remainingTotalBytes: number): Promise<Buffer> {
  if (!response.body) {
    const data = Buffer.from(await response.arrayBuffer());
    if (data.byteLength > remainingTotalBytes) {
      throw createReadTotalBytesLimitError(data.byteLength);
    }
    if (data.byteLength > MAX_IMAGE_ATTACHMENT_BYTES) {
      throw createReadImageBytesLimitError(data.byteLength);
    }
    return data;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      const chunk = Buffer.from(result.value);
      totalBytes += chunk.byteLength;
      if (totalBytes > remainingTotalBytes) {
        await throwAfterCancel(reader, createReadTotalBytesLimitError(totalBytes));
      }
      if (totalBytes > MAX_IMAGE_ATTACHMENT_BYTES) {
        await throwAfterCancel(reader, createReadImageBytesLimitError(totalBytes));
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof PrReviewImageReadLimitError) {
      throw error;
    }
    throw createReadStreamError(error, totalBytes, remainingTotalBytes);
  }

  return Buffer.concat(chunks, totalBytes);
}

async function fetchAttachmentData(
  reference: PrReviewImageReference,
  headers: RequestHeaders,
  remainingTotalBytes: number,
): Promise<{
  data: Buffer;
  contentType: string;
}> {
  const response = await fetchAllowedAttachmentResponse(reference.url, headers);
  if (!response.ok) {
    throw new Error(`Failed to download PR image attachment ${reference.placeholder}: HTTP ${response.status}`);
  }
  const contentType = getRequiredHeader(response.headers, 'content-type');
  validateSupportedImageContentType(contentType);
  const contentLength = getValidatedContentLength(response.headers);
  if (contentLength !== undefined) {
    assertRemainingTotalBytes(contentLength, remainingTotalBytes);
  }
  const data = await readResponseBodyWithinLimit(response, remainingTotalBytes);
  return { data, contentType };
}

function writeAttachmentFile(
  tempRoot: string,
  index: number,
  data: Buffer,
  fileExtension: string,
): { tempPath: string; fileName: string } {
  fs.mkdirSync(tempRoot, { recursive: true, mode: 0o700 });
  const fileName = `image-${index}.${fileExtension}`;
  const tempPath = path.join(tempRoot, fileName);
  fs.writeFileSync(tempPath, data, { mode: 0o600, flag: 'wx' });
  return { tempPath, fileName };
}

function cleanupCreatedAttachments(tempRoot: string, removeRoot: boolean, tempPaths: readonly string[]): void {
  if (removeRoot) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    return;
  }
  for (const tempPath of tempPaths) {
    fs.rmSync(tempPath, { force: true });
  }
}

function createDownloadFailure(
  reference: PrReviewImageReference,
  error: unknown,
): PrReviewImageDownloadFailure {
  return {
    placeholder: reference.placeholder,
    reason: sanitizeFailureReason(getErrorMessage(error)),
  };
}

function createLimitFailure(
  reference: PrReviewImageReference,
  reason: string,
): PrReviewImageDownloadFailure {
  return {
    placeholder: reference.placeholder,
    reason,
  };
}

export async function downloadPrReviewAttachments(
  options: DownloadPrReviewAttachmentsOptions,
): Promise<DownloadedPrReviewAttachments> {
  if (options.references.length === 0) {
    return { attachments: [], failures: [], cleanupAttachments: () => undefined };
  }

  for (const reference of options.references) {
    assertAllowedAttachmentUrl(reference.url, 'URL');
  }

  const token = resolveGhAuthToken(options.cwd);
  const headers = createRequestHeaders(token);
  const ownsTempRoot = options.tempRoot === undefined;
  const tempRoot = options.tempRoot ?? fs.mkdtempSync(path.join(os.tmpdir(), 'takt-pr-attachments-'));
  const attachments: StoredImageAttachment[] = [];
  const referencesToDownload = options.references.slice(0, MAX_PR_REVIEW_IMAGE_REFERENCES);
  const failures: PrReviewImageDownloadFailure[] = options.references
    .slice(MAX_PR_REVIEW_IMAGE_REFERENCES)
    .map((reference) => createLimitFailure(reference, createPrReviewImageReferenceLimitMessage()));
  const createdTempPaths: string[] = [];
  let totalDownloadedBytes = 0;
  let totalBytesLimitReached = false;

  for (const [index, reference] of referencesToDownload.entries()) {
    if (totalBytesLimitReached) {
      failures.push(createLimitFailure(reference, createPrReviewImageTotalBytesLimitMessage()));
      continue;
    }
    try {
      const remainingTotalBytes = MAX_PR_REVIEW_IMAGE_ATTACHMENT_TOTAL_BYTES - totalDownloadedBytes;
      const { data, contentType } = await fetchAttachmentData(reference, headers, remainingTotalBytes);
      totalDownloadedBytes += data.byteLength;
      const validated = validateImageAttachmentData({ contentType, data });
      const { tempPath, fileName } = writeAttachmentFile(tempRoot, index + 1, data, validated.fileExtension);
      createdTempPaths.push(tempPath);
      attachments.push({
        placeholder: reference.placeholder,
        tempPath,
        fileName,
      });
    } catch (error) {
      if (error instanceof PrReviewImageReadLimitError) {
        totalDownloadedBytes += error.consumedBytes;
      }
      failures.push(createDownloadFailure(reference, error));
      if (
        error instanceof PrReviewImageTotalBytesLimitError
        || (error instanceof PrReviewImageReadLimitError && error.totalLimitReached)
        || totalDownloadedBytes >= MAX_PR_REVIEW_IMAGE_ATTACHMENT_TOTAL_BYTES
      ) {
        totalBytesLimitReached = true;
      }
    }
  }

  return {
    attachments,
    failures,
    cleanupAttachments: () => {
      cleanupCreatedAttachments(tempRoot, ownsTempRoot, createdTempPaths);
    },
  };
}

export async function resolvePrReviewAttachments(
  prReview: PrReviewData,
  cwd?: string,
): Promise<PrReviewAttachmentResolution> {
  const extracted = extractPrReviewImageReferences(prReview);
  const downloaded = await downloadPrReviewAttachments({
    references: extracted.references,
    ...(cwd ? { cwd } : {}),
  });
  return {
    prReview: annotateFailedPrReviewImageReferences(extracted.prReview, downloaded.failures),
    attachments: downloaded.attachments,
    cleanupAttachments: downloaded.cleanupAttachments,
  };
}
