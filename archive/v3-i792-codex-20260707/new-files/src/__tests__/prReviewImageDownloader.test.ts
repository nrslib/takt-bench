import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MAX_IMAGE_ATTACHMENT_BYTES } from '../shared/utils/imageMime.js';
import type { PrReviewData } from '../infra/git/index.js';

const mockExecFileSync = vi.fn();
const mockHttpsGet = vi.fn();

vi.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

vi.mock('node:https', () => ({
  get: (...args: unknown[]) => mockHttpsGet(...args),
}));

const { preparePrReviewTaskWithImageAttachments } = await import('../features/tasks/prReviewImageAttachments.js');

type MockResponse = EventEmitter & {
  headers: IncomingHttpHeaders;
  statusCode?: number;
  resume: () => void;
};

type MockRequest = EventEmitter & {
  destroy: (error: Error) => void;
};

function createPrReview(imageUrl: string): PrReviewData {
  return {
    number: 456,
    title: 'Fix auth bug',
    body: `Screenshot ![image](${imageUrl})`,
    url: 'https://github.com/org/repo/pull/456',
    headRefName: 'feature/fix-auth-bug',
    baseRefName: 'main',
    comments: [],
    reviews: [],
    files: ['src/auth.ts'],
  };
}

function mockHttpsImageResponse(params: {
  statusCode?: number;
  headers: IncomingHttpHeaders;
  data?: Buffer;
}): void {
  mockHttpsGet.mockImplementationOnce((_url: URL, _options: unknown, callback: (response: IncomingMessage) => void) => {
    const response = Object.assign(new EventEmitter(), {
      headers: params.headers,
      statusCode: params.statusCode,
      resume: vi.fn(),
    }) as MockResponse;
    const request = new EventEmitter() as MockRequest;
    request.destroy = (error: Error) => {
      request.emit('error', error);
    };

    queueMicrotask(() => {
      callback(response as IncomingMessage);
      if (params.data) {
        response.emit('data', params.data);
      }
      response.emit('end');
    });
    return request;
  });
}

async function captureRejectedError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    return error as Error;
  }
  throw new Error('Expected promise to reject.');
}

describe('default PR review image downloader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFileSync.mockReturnValue('gh-token\n');
  });

  it('should download a verified GitHub image through an authenticated request', async () => {
    const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const imageUrl = 'https://github.com/user-attachments/assets/11111111-1111-4111-8111-111111111111';
    mockHttpsImageResponse({
      statusCode: 200,
      headers: {
        'content-type': 'image/png',
        'content-length': String(pngData.length),
      },
      data: pngData,
    });

    const result = await preparePrReviewTaskWithImageAttachments({
      cwd: '/repo',
      prReview: createPrReview(imageUrl),
    });

    expect(mockExecFileSync).toHaveBeenCalledWith('gh', ['auth', 'token'], expect.objectContaining({
      cwd: '/repo',
      encoding: 'utf-8',
    }));
    expect(mockHttpsGet).toHaveBeenCalledWith(
      new URL(imageUrl),
      { headers: { Authorization: 'Bearer gh-token' } },
      expect.any(Function),
    );
    expect(result.attachments).toEqual([
      {
        placeholder: '[Image #1]',
        tempPath: expect.stringContaining('image-1.png'),
        fileName: 'image-1.png',
      },
    ]);
    expect(fs.readFileSync(result.attachments[0]!.tempPath)).toEqual(pngData);

    const tempPath = result.attachments[0]!.tempPath;
    result.cleanupAttachments();
    expect(fs.existsSync(tempPath)).toBe(false);
  });

  it('should reject a response whose Content-Length exceeds the image limit', async () => {
    const imageUrl = 'https://github.com/user-attachments/assets/22222222-2222-4222-8222-222222222222';
    mockHttpsImageResponse({
      statusCode: 200,
      headers: {
        'content-type': 'image/png',
        'content-length': String(MAX_IMAGE_ATTACHMENT_BYTES + 1),
      },
    });

    await expect(preparePrReviewTaskWithImageAttachments({
      cwd: '/repo',
      prReview: createPrReview(imageUrl),
    })).rejects.toThrow(`PR image attachment exceeds the ${MAX_IMAGE_ATTACHMENT_BYTES} byte limit.`);
  });

  it('should reject a response without an HTTP status without exposing the image URL', async () => {
    const imageUrl = 'https://github.com/user-attachments/assets/33333333-3333-4333-8333-333333333333?token=secret-token';
    mockHttpsImageResponse({
      headers: {
        'content-type': 'image/png',
      },
    });

    const error = await captureRejectedError(preparePrReviewTaskWithImageAttachments({
      cwd: '/repo',
      prReview: createPrReview(imageUrl),
    }));
    expect(error.message).toBe('PR image attachment download failed without an HTTP status from host: github.com');
    expect(error.message).not.toContain(imageUrl);
    expect(error.message).not.toContain('secret-token');
    expect(error.message).not.toContain('/user-attachments/assets/');
  });

  it('should reject redirects to non-GitHub attachment hosts without exposing the redirect URL', async () => {
    const imageUrl = 'https://github.com/user-attachments/assets/44444444-4444-4444-8444-444444444444?token=source-secret';
    const redirectUrl = 'https://example.com/image.png?signature=redirect-secret';
    mockHttpsImageResponse({
      statusCode: 302,
      headers: {
        location: redirectUrl,
      },
    });

    const error = await captureRejectedError(preparePrReviewTaskWithImageAttachments({
      cwd: '/repo',
      prReview: createPrReview(imageUrl),
    }));
    expect(error.message).toBe('Unsupported PR image attachment redirect host: example.com');
    expect(error.message).not.toContain(redirectUrl);
    expect(error.message).not.toContain('source-secret');
    expect(error.message).not.toContain('redirect-secret');
    expect(error.message).not.toContain('/image.png');
    expect(mockHttpsGet).toHaveBeenCalledTimes(1);
  });
});
