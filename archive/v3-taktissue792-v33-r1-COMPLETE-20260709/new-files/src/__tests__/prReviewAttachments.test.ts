import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_PR_REVIEW_IMAGE_ATTACHMENT_TOTAL_BYTES,
  MAX_PR_REVIEW_IMAGE_REFERENCES,
} from '../infra/github/prReviewAttachmentLimits.js';
import { downloadPrReviewAttachments, resolvePrReviewAttachments } from '../infra/github/prReviewAttachments.js';
import { MAX_IMAGE_ATTACHMENT_BYTES } from '../shared/utils/imageAttachmentData.js';
import type { PrReviewData } from '../infra/git/types.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const mockExecFileSync = vi.mocked(execFileSync);
const originalFetch = globalThis.fetch;

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GITHUB_ATTACHMENT_URL = 'https://github.com/user-attachments/assets/33333333-3333-4333-8333-333333333333';
const SECOND_GITHUB_ATTACHMENT_URL = 'https://github.com/user-attachments/assets/44444444-4444-4444-8444-444444444444';
const EXTERNAL_IMAGE_URL = 'https://example.com/screenshot.png';
const SECRET_EXTERNAL_IMAGE_URL = 'https://example.com/private/screenshot.png?token=secret-token';

let tempRoot: string;

function mockFetchResponse(params: {
  body?: BodyInit | null;
  contentType?: string;
  url?: string;
  contentLength?: string;
  status?: number;
  location?: string;
}): Response {
  const headers = {
    ...(params.contentType ? { 'content-type': params.contentType } : {}),
    ...(params.contentLength ? { 'content-length': params.contentLength } : {}),
    ...(params.location ? { location: params.location } : {}),
  };
  const response = new Response(params.body, {
    status: params.status ?? 200,
    headers,
  });
  Object.defineProperty(response, 'url', {
    configurable: true,
    value: params.url ?? '',
  });
  return response;
}

function createErroringStream(chunkBytes: number, message: string): ReadableStream<Uint8Array> {
  let chunkSent = false;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!chunkSent) {
        chunkSent = true;
        controller.enqueue(new Uint8Array(chunkBytes));
        return;
      }
      controller.error(new Error(message));
    },
  });
}

function mockReaderResponse(params: {
  reader: Pick<ReadableStreamDefaultReader<Uint8Array>, 'read' | 'cancel'>;
  contentType: string;
}): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': params.contentType }),
    body: {
      getReader: () => params.reader,
    },
  } as Response;
}

function createRejectingCancelReader(
  chunkBytes: number,
  message: string,
): Pick<ReadableStreamDefaultReader<Uint8Array>, 'read' | 'cancel'> {
  let chunkSent = false;
  return {
    async read() {
      if (!chunkSent) {
        chunkSent = true;
        return { done: false, value: new Uint8Array(chunkBytes) };
      }
      return { done: true, value: undefined };
    },
    async cancel() {
      throw new Error(message);
    },
  };
}

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(tmpdir(), 'takt-pr-attachments-'));
  mockExecFileSync.mockReturnValue(Buffer.from('gh-token\n'));
  globalThis.fetch = vi.fn(async () => mockFetchResponse({
    body: PNG_BYTES,
    contentType: 'image/png',
    url: GITHUB_ATTACHMENT_URL,
  }));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  if (fs.existsSync(tempRoot)) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe('downloadPrReviewAttachments', () => {
  it('should download GitHub attachments with gh authentication and store task attachments', async () => {
    const result = await downloadPrReviewAttachments({
      references: [{ placeholder: '[Image #1]', url: GITHUB_ATTACHMENT_URL }],
      tempRoot,
      cwd: '/repo',
    });

    expect(mockExecFileSync).toHaveBeenCalledWith('gh', ['auth', 'token'], {
      cwd: '/repo',
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      GITHUB_ATTACHMENT_URL,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer gh-token',
        }),
        redirect: 'manual',
      }),
    );
    expect(result.attachments).toEqual([{
      placeholder: '[Image #1]',
      tempPath: expect.stringMatching(/image-1\.png$/),
      fileName: 'image-1.png',
    }]);
    expect(fs.readFileSync(result.attachments[0]!.tempPath)).toEqual(PNG_BYTES);
    expect(result.failures).toEqual([]);
  });

  it('should fail fast when gh authentication cannot provide a token', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('not authenticated');
    });

    await expect(downloadPrReviewAttachments({
      references: [{ placeholder: '[Image #1]', url: GITHUB_ATTACHMENT_URL }],
      tempRoot,
      cwd: '/repo',
    })).rejects.toThrow('Failed to resolve GitHub authentication token');

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should reject non-GitHub URLs without sending a network request', async () => {
    let caughtError: unknown;
    try {
      await downloadPrReviewAttachments({
        references: [{ placeholder: '[Image #1]', url: SECRET_EXTERNAL_IMAGE_URL }],
        tempRoot,
        cwd: '/repo',
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(Error);
    const message = (caughtError as Error).message;
    expect(message).toContain('Unsupported PR image attachment URL: host example.com');
    expect(message).not.toContain('/private/screenshot.png');
    expect(message).not.toContain('secret-token');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should record GitHub attachment redirects that leave the allowlist without following them', async () => {
    globalThis.fetch = vi.fn(async () => mockFetchResponse({
      status: 302,
      location: SECRET_EXTERNAL_IMAGE_URL,
    }));

    const result = await downloadPrReviewAttachments({
      references: [{ placeholder: '[Image #1]', url: GITHUB_ATTACHMENT_URL }],
      tempRoot,
      cwd: '/repo',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      GITHUB_ATTACHMENT_URL,
      expect.objectContaining({ redirect: 'manual' }),
    );
    expect(result.attachments).toEqual([]);
    expect(result.failures).toEqual([expect.objectContaining({
      placeholder: '[Image #1]',
      reason: expect.stringContaining('Unsupported PR image attachment redirect URL'),
    })]);
    expect(result.failures[0]!.reason).toContain('host example.com');
    expect(result.failures[0]!.reason).not.toContain('/private/screenshot.png');
    expect(result.failures[0]!.reason).not.toContain('secret-token');
  });

  it('should record oversized attachments before writing a temp file when content length is too large', async () => {
    globalThis.fetch = vi.fn(async () => mockFetchResponse({
      body: Buffer.alloc(0),
      contentType: 'image/png',
      contentLength: String(MAX_IMAGE_ATTACHMENT_BYTES + 1),
      url: GITHUB_ATTACHMENT_URL,
    }));

    const result = await downloadPrReviewAttachments({
      references: [{ placeholder: '[Image #1]', url: GITHUB_ATTACHMENT_URL }],
      tempRoot,
      cwd: '/repo',
    });

    expect(result.attachments).toEqual([]);
    expect(result.failures[0]?.reason).toContain('Image attachment exceeds');
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('should record oversized attachments while reading a response without content length', async () => {
    globalThis.fetch = vi.fn(async () => mockFetchResponse({
      body: Buffer.alloc(MAX_IMAGE_ATTACHMENT_BYTES + 1),
      contentType: 'image/png',
      url: GITHUB_ATTACHMENT_URL,
    }));

    const result = await downloadPrReviewAttachments({
      references: [{ placeholder: '[Image #1]', url: GITHUB_ATTACHMENT_URL }],
      tempRoot,
      cwd: '/repo',
    });

    expect(result.attachments).toEqual([]);
    expect(result.failures[0]?.reason).toContain('Image attachment exceeds');
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('should reject unsupported content type before reading the response body', async () => {
    let readBody = false;
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      get body() {
        readBody = true;
        return new ReadableStream();
      },
      arrayBuffer: async () => {
        readBody = true;
        return new ArrayBuffer(0);
      },
    } as Response;
    globalThis.fetch = vi.fn(async () => response);

    const result = await downloadPrReviewAttachments({
      references: [{ placeholder: '[Image #1]', url: GITHUB_ATTACHMENT_URL }],
      tempRoot,
      cwd: '/repo',
    });

    expect(readBody).toBe(false);
    expect(result.attachments).toEqual([]);
    expect(result.failures[0]?.reason).toContain('Unsupported image content type: text/html');
  });

  it('should only remove created attachment files when caller owns tempRoot', async () => {
    const sentinelPath = path.join(tempRoot, 'sentinel.txt');
    fs.writeFileSync(sentinelPath, 'keep');
    const result = await downloadPrReviewAttachments({
      references: [{ placeholder: '[Image #1]', url: GITHUB_ATTACHMENT_URL }],
      tempRoot,
      cwd: '/repo',
    });

    result.cleanupAttachments();

    expect(fs.existsSync(sentinelPath)).toBe(true);
    expect(fs.existsSync(result.attachments[0]!.tempPath)).toBe(false);
  });

  it('should not fetch GitHub image references beyond the configured reference limit', async () => {
    const references = Array.from({ length: MAX_PR_REVIEW_IMAGE_REFERENCES + 1 }, (_, index) => ({
      placeholder: `[Image #${index + 1}]`,
      url: `https://github.com/user-attachments/assets/reference-limit-${index + 1}`,
    }));

    const result = await downloadPrReviewAttachments({
      references,
      tempRoot,
      cwd: '/repo',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(MAX_PR_REVIEW_IMAGE_REFERENCES);
    expect(result.attachments).toHaveLength(MAX_PR_REVIEW_IMAGE_REFERENCES);
    expect(result.failures).toEqual([{
      placeholder: `[Image #${MAX_PR_REVIEW_IMAGE_REFERENCES + 1}]`,
      reason: expect.stringContaining('PR image attachment limit exceeded'),
    }]);
  });

  it('should stop fetching later images after the total download size limit is reached', async () => {
    const maxImageBytes = Buffer.concat([
      PNG_BYTES,
      Buffer.alloc(MAX_IMAGE_ATTACHMENT_BYTES - PNG_BYTES.length),
    ]);
    const thirdImageContentLength = MAX_PR_REVIEW_IMAGE_ATTACHMENT_TOTAL_BYTES
      - (MAX_IMAGE_ATTACHMENT_BYTES * 2)
      + 1;
    const references = [1, 2, 3, 4].map((index) => ({
      placeholder: `[Image #${index}]`,
      url: `https://github.com/user-attachments/assets/total-limit-${index}`,
    }));
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('total-limit-1') || value.endsWith('total-limit-2')) {
        return mockFetchResponse({
          body: maxImageBytes,
          contentType: 'image/png',
          contentLength: String(maxImageBytes.byteLength),
          url: value,
        });
      }
      if (value.endsWith('total-limit-3')) {
        return mockFetchResponse({
          body: Buffer.alloc(0),
          contentType: 'image/png',
          contentLength: String(thirdImageContentLength),
          url: value,
        });
      }
      throw new Error('fetch should not be called after total byte limit is reached');
    });

    const result = await downloadPrReviewAttachments({
      references,
      tempRoot,
      cwd: '/repo',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(result.attachments).toHaveLength(2);
    expect(result.failures).toEqual([
      {
        placeholder: '[Image #3]',
        reason: expect.stringContaining('PR image attachment total size exceeds'),
      },
      {
        placeholder: '[Image #4]',
        reason: expect.stringContaining('PR image attachment total size exceeds'),
      },
    ]);
    expect(fs.readdirSync(tempRoot).sort()).toEqual(['image-1.png', 'image-2.png']);
  });

  it('should count downloaded bytes from invalid image bodies toward the total limit', async () => {
    const invalidMaxImageBytes = Buffer.alloc(MAX_IMAGE_ATTACHMENT_BYTES);
    const remainingAfterTwoInvalidBodies = MAX_PR_REVIEW_IMAGE_ATTACHMENT_TOTAL_BYTES
      - (MAX_IMAGE_ATTACHMENT_BYTES * 2);
    const references = [1, 2, 3, 4].map((index) => ({
      placeholder: `[Image #${index}]`,
      url: `https://github.com/user-attachments/assets/invalid-total-limit-${index}`,
    }));
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('invalid-total-limit-1') || value.endsWith('invalid-total-limit-2')) {
        return mockFetchResponse({
          body: invalidMaxImageBytes,
          contentType: 'image/png',
          url: value,
        });
      }
      if (value.endsWith('invalid-total-limit-3')) {
        return mockFetchResponse({
          body: Buffer.alloc(remainingAfterTwoInvalidBodies + 1),
          contentType: 'image/png',
          url: value,
        });
      }
      throw new Error('fetch should not be called after invalid bodies consume the total byte limit');
    });

    const result = await downloadPrReviewAttachments({
      references,
      tempRoot,
      cwd: '/repo',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(result.attachments).toEqual([]);
    expect(result.failures).toEqual([
      {
        placeholder: '[Image #1]',
        reason: 'Image content type does not match magic bytes.',
      },
      {
        placeholder: '[Image #2]',
        reason: 'Image content type does not match magic bytes.',
      },
      {
        placeholder: '[Image #3]',
        reason: expect.stringContaining('PR image attachment total size exceeds'),
      },
      {
        placeholder: '[Image #4]',
        reason: expect.stringContaining('PR image attachment total size exceeds'),
      },
    ]);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('should count bytes from oversized bodies toward the total limit before fetching later images', async () => {
    const oversizedBody = Buffer.alloc(MAX_IMAGE_ATTACHMENT_BYTES + 1);
    const references = [1, 2, 3, 4].map((index) => ({
      placeholder: `[Image #${index}]`,
      url: `https://github.com/user-attachments/assets/oversized-total-limit-${index}`,
    }));
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('oversized-total-limit-4')) {
        throw new Error('fetch should not be called after oversized bodies consume the total byte limit');
      }
      return mockFetchResponse({
        body: oversizedBody,
        contentType: 'image/png',
        url: value,
      });
    });

    const result = await downloadPrReviewAttachments({
      references,
      tempRoot,
      cwd: '/repo',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(result.attachments).toEqual([]);
    expect(result.failures).toEqual([
      {
        placeholder: '[Image #1]',
        reason: expect.stringContaining('Image attachment exceeds'),
      },
      {
        placeholder: '[Image #2]',
        reason: expect.stringContaining('Image attachment exceeds'),
      },
      {
        placeholder: '[Image #3]',
        reason: expect.stringContaining('PR image attachment total size exceeds'),
      },
      {
        placeholder: '[Image #4]',
        reason: expect.stringContaining('PR image attachment total size exceeds'),
      },
    ]);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('should count bytes from stream read failures toward the total limit before fetching later images', async () => {
    const remainingAfterTwoFailures = MAX_PR_REVIEW_IMAGE_ATTACHMENT_TOTAL_BYTES - (MAX_IMAGE_ATTACHMENT_BYTES * 2);
    const references = [1, 2, 3, 4].map((index) => ({
      placeholder: `[Image #${index}]`,
      url: `https://github.com/user-attachments/assets/read-failure-total-limit-${index}`,
    }));
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('read-failure-total-limit-1')) {
        return mockFetchResponse({
          body: createErroringStream(MAX_IMAGE_ATTACHMENT_BYTES, 'stream failed 1'),
          contentType: 'image/png',
          url: value,
        });
      }
      if (value.endsWith('read-failure-total-limit-2')) {
        return mockFetchResponse({
          body: createErroringStream(MAX_IMAGE_ATTACHMENT_BYTES, 'stream failed 2'),
          contentType: 'image/png',
          url: value,
        });
      }
      if (value.endsWith('read-failure-total-limit-3')) {
        return mockFetchResponse({
          body: createErroringStream(remainingAfterTwoFailures, 'stream failed 3'),
          contentType: 'image/png',
          url: value,
        });
      }
      throw new Error('fetch should not be called after stream failures consume the total byte limit');
    });

    const result = await downloadPrReviewAttachments({
      references,
      tempRoot,
      cwd: '/repo',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(result.attachments).toEqual([]);
    expect(result.failures).toEqual([
      {
        placeholder: '[Image #1]',
        reason: expect.stringContaining('stream failed 1'),
      },
      {
        placeholder: '[Image #2]',
        reason: expect.stringContaining('stream failed 2'),
      },
      {
        placeholder: '[Image #3]',
        reason: expect.stringContaining('stream failed 3'),
      },
      {
        placeholder: '[Image #4]',
        reason: expect.stringContaining('PR image attachment total size exceeds'),
      },
    ]);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('should count bytes when stream cancellation fails after a read limit is reached', async () => {
    const oversizedChunkBytes = MAX_IMAGE_ATTACHMENT_BYTES + 1;
    const references = [1, 2, 3, 4].map((index) => ({
      placeholder: `[Image #${index}]`,
      url: `https://github.com/user-attachments/assets/cancel-failure-total-limit-${index}`,
    }));
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith('cancel-failure-total-limit-4')) {
        throw new Error('fetch should not be called after cancel failures consume the total byte limit');
      }
      return mockReaderResponse({
        reader: createRejectingCancelReader(oversizedChunkBytes, 'cancel failed'),
        contentType: 'image/png',
      });
    });

    const result = await downloadPrReviewAttachments({
      references,
      tempRoot,
      cwd: '/repo',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(result.attachments).toEqual([]);
    expect(result.failures).toEqual([
      {
        placeholder: '[Image #1]',
        reason: expect.stringContaining('Image attachment exceeds'),
      },
      {
        placeholder: '[Image #2]',
        reason: expect.stringContaining('Image attachment exceeds'),
      },
      {
        placeholder: '[Image #3]',
        reason: expect.stringContaining('PR image attachment total size exceeds'),
      },
      {
        placeholder: '[Image #4]',
        reason: expect.stringContaining('PR image attachment total size exceeds'),
      },
    ]);
    expect(result.failures[0]?.reason).toContain('failed to cancel PR image attachment stream');
    expect(result.failures[1]?.reason).toContain('failed to cancel PR image attachment stream');
    expect(result.failures[2]?.reason).toContain('failed to cancel PR image attachment stream');
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });
});

describe('resolvePrReviewAttachments', () => {
  it('should keep usable attachments when another PR image fails to download', async () => {
    const prReview: PrReviewData = {
      number: 42,
      title: 'Fix screenshots',
      body: `first ![one](${GITHUB_ATTACHMENT_URL}) second ![two](${SECOND_GITHUB_ATTACHMENT_URL})`,
      url: 'https://github.com/org/repo/pull/42',
      headRefName: 'fix/screenshots',
      baseRefName: 'main',
      comments: [],
      reviews: [],
      files: [],
    };
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === SECOND_GITHUB_ATTACHMENT_URL) {
        return mockFetchResponse({
          status: 404,
          contentType: 'text/plain',
          body: Buffer.from('not found'),
        });
      }
      return mockFetchResponse({
        body: PNG_BYTES,
        contentType: 'image/png',
        url: GITHUB_ATTACHMENT_URL,
      });
    });

    const result = await resolvePrReviewAttachments(prReview, '/repo');

    expect(result.attachments).toEqual([expect.objectContaining({
      placeholder: '[Image #1]',
      fileName: 'image-1.png',
    })]);
    expect(result.prReview.body).toContain('first [Image #1]');
    expect(result.prReview.body).toContain('[Image #2] download failed: Failed to download PR image attachment [Image #2]: HTTP 404');
    result.cleanupAttachments();
  });

  it('should sanitize URL details from failure annotations written to PR review text', async () => {
    const prReview: PrReviewData = {
      number: 42,
      title: 'Fix screenshots',
      body: `first ![one](${GITHUB_ATTACHMENT_URL}) second ![two](${SECOND_GITHUB_ATTACHMENT_URL})`,
      url: 'https://github.com/org/repo/pull/42',
      headRefName: 'fix/screenshots',
      baseRefName: 'main',
      comments: [],
      reviews: [],
      files: [],
    };
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === SECOND_GITHUB_ATTACHMENT_URL) {
        throw new Error('fetch failed for https://private-user-images.githubusercontent.com/signed/path/image.png?token=secret-token');
      }
      return mockFetchResponse({
        body: PNG_BYTES,
        contentType: 'image/png',
        url: GITHUB_ATTACHMENT_URL,
      });
    });

    const result = await resolvePrReviewAttachments(prReview, '/repo');

    expect(result.prReview.body).toContain('https://private-user-images.githubusercontent.com');
    expect(result.prReview.body).not.toContain('/signed/path/image.png');
    expect(result.prReview.body).not.toContain('secret-token');
    result.cleanupAttachments();
  });
});
