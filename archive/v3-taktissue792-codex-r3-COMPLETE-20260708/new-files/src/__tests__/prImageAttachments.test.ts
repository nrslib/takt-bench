import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { PassThrough } from 'node:stream';
import type { PrReviewData } from '../infra/git/types.js';
import {
  MAX_PR_IMAGE_ATTACHMENT_BYTES,
  PR_IMAGE_ATTACHMENT_DOWNLOAD_TIMEOUT_MS,
  resolvePrReviewImageAttachments,
} from '../infra/github/prImageAttachments.js';

const mockExecFileSync = vi.hoisted(() => vi.fn());
const mockHttpsRequest = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFileSync: mockExecFileSync,
}));
vi.mock('node:https', () => ({
  request: mockHttpsRequest,
}));

const PNG_DATA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const JPEG_DATA = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function createMockPrReview(overrides: Partial<PrReviewData> = {}): PrReviewData {
  return {
    number: 456,
    title: 'Fix auth bug',
    body: 'PR description',
    url: 'https://github.com/org/repo/pull/456',
    headRefName: 'feature/fix-auth-bug',
    baseRefName: 'main',
    comments: [],
    reviews: [],
    files: ['src/auth.ts'],
    ...overrides,
  };
}

interface MockHttpsRequestOptions {
  hostname?: string;
  path?: string;
  headers?: Record<string, string>;
}

type MockHttpsResponse = PassThrough & {
  statusCode?: number;
  headers: Record<string, string>;
};

type MockHttpsRequestHandle = EventEmitter & {
  end: () => void;
  destroy: (error?: Error) => void;
  setTimeout: (milliseconds: number, callback: () => void) => void;
};

function createMockHttpsRequestHandle(onEnd: () => void): MockHttpsRequestHandle {
  const request = new EventEmitter() as MockHttpsRequestHandle;
  request.setTimeout = () => undefined;
  request.end = onEnd;
  request.destroy = (error?: Error) => {
    request.emit('error', error);
  };
  return request;
}

function mockGhAuthToken(): void {
  mockExecFileSync.mockImplementation((command: string, args: string[]) => {
    expect(command).toBe('gh');
    expect(args).toEqual(['auth', 'token']);
    return 'gh-token\n';
  });
}

function mockGitHubAttachmentDownload(
  fixtures: Record<string, { contentType: string; body: Buffer; headers?: Record<string, string> }>,
): void {
  mockGhAuthToken();
  mockHttpsRequest.mockImplementation((options: MockHttpsRequestOptions, callback: (response: MockHttpsResponse) => void) => {
    expect(options.headers?.authorization).toBe('Bearer gh-token');
    const url = `https://${options.hostname}${options.path}`;
    const fixture = fixtures[url];
    if (!fixture) {
      throw new Error(`Unexpected image URL: ${url}`);
    }

    const response = new PassThrough() as MockHttpsResponse;
    const headerNames = new Set(Object.keys(fixture.headers ?? {}).map((name) => name.toLowerCase()));
    response.statusCode = 200;
    response.headers = {
      ...(headerNames.has('content-type') ? {} : { 'content-type': fixture.contentType }),
      ...(headerNames.has('content-length') ? {} : { 'content-length': String(fixture.body.length) }),
      ...fixture.headers,
    };

    const request = new EventEmitter() as EventEmitter & {
      end: () => void;
      destroy: (error?: Error) => void;
      setTimeout: (milliseconds: number, callback: () => void) => void;
    };
    request.setTimeout = () => undefined;
    request.end = () => {
      callback(response);
      response.end(fixture.body);
    };
    request.destroy = (error?: Error) => {
      request.emit('error', error);
      response.destroy(error);
    };
    return request;
  });
}

describe('resolvePrReviewImageAttachments', () => {
  let testDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    testDir = fs.mkdtempSync(path.join(tmpdir(), 'takt-pr-images-'));
  });

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should download GitHub markdown and HTML images from all PR review fields', async () => {
    const pngUrl = 'https://github.com/user-attachments/assets/png-1';
    const jpegUrl = 'https://github.com/org/repo/assets/jpeg-2';
    const prReview = createMockPrReview({
      body: `Body image ![screenshot](${pngUrl})`,
      comments: [{ author: 'commenter', body: `Comment image <img src="${jpegUrl}" />` }],
      reviews: [{ author: 'reviewer', body: `Duplicate image ![again](${pngUrl})` }],
    });
    mockGitHubAttachmentDownload({
      [pngUrl]: { contentType: 'image/png', body: PNG_DATA },
      [jpegUrl]: { contentType: 'image/jpeg; charset=binary', body: JPEG_DATA },
    });

    const result = await resolvePrReviewImageAttachments(prReview, testDir);

    expect(result.prReview).not.toBe(prReview);
    expect(result.prReview.body).toContain('Body image [Image #1]');
    expect(result.prReview.body).not.toContain(pngUrl);
    expect(result.prReview.comments[0]?.body).toContain('Comment image [Image #2]');
    expect(result.prReview.comments[0]?.body).not.toContain(jpegUrl);
    expect(result.prReview.reviews[0]?.body).toContain('Duplicate image [Image #1]');
    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['auth', 'token'],
      expect.objectContaining({ cwd: testDir }),
    );
    expect(mockHttpsRequest).toHaveBeenCalledTimes(2);
    expect(result.attachments).toEqual([
      expect.objectContaining({ placeholder: '[Image #1]', fileName: 'image-1.png' }),
      expect.objectContaining({ placeholder: '[Image #2]', fileName: 'image-2.jpg' }),
    ]);
    expect(fs.readFileSync(result.attachments[0]!.tempPath)).toEqual(PNG_DATA);
    expect(fs.readFileSync(result.attachments[1]!.tempPath)).toEqual(JPEG_DATA);

    const tempDir = path.dirname(result.attachments[0]!.tempPath);
    result.cleanup();
    expect(fs.existsSync(tempDir)).toBe(false);
  });

  it('should ignore non-GitHub image URLs without downloading or replacing them', async () => {
    const externalUrl = 'https://img.shields.io/badge/build-passing.svg';
    const prReview = createMockPrReview({
      body: `External badge ![badge](${externalUrl})`,
      comments: [{ author: 'commenter', body: '<img src="https://example.com/image.png" />' }],
    });

    const result = await resolvePrReviewImageAttachments(prReview, testDir);

    expect(mockExecFileSync).not.toHaveBeenCalled();
    expect(mockHttpsRequest).not.toHaveBeenCalled();
    expect(result.attachments).toEqual([]);
    expect(result.prReview.body).toBe(prReview.body);
    expect(result.prReview.comments[0]?.body).toBe(prReview.comments[0]?.body);
  });

  it('should reject allowlisted images when Content-Type and magic bytes disagree', async () => {
    const imageUrl = 'https://github.com/user-attachments/assets/mismatch';
    const prReview = createMockPrReview({
      body: `Mismatched image ![image](${imageUrl})`,
    });
    mockGitHubAttachmentDownload({
      [imageUrl]: { contentType: 'image/jpeg', body: PNG_DATA },
    });

    await expect(resolvePrReviewImageAttachments(prReview, testDir)).rejects.toThrow(/Content-Type.*magic bytes/i);
  });

  it('should not expose signed private image URLs when gh download fails', async () => {
    const imageUrl = 'https://private-user-images.githubusercontent.com/123/asset.png?token=secret-token#frag';
    const prReview = createMockPrReview({
      body: `Private image ![image](${imageUrl})`,
    });
    mockGhAuthToken();
    mockHttpsRequest.mockImplementation(() => {
      const request = new EventEmitter() as EventEmitter & {
        end: () => void;
        destroy: (error?: Error) => void;
        setTimeout: (milliseconds: number, callback: () => void) => void;
      };
      request.setTimeout = () => undefined;
      request.end = () => {
        request.emit('error', new Error(`request failed for ${imageUrl}`));
      };
      request.destroy = (error?: Error) => {
        request.emit('error', error);
      };
      return request;
    });

    let message = '';
    try {
      await resolvePrReviewImageAttachments(prReview, testDir);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe('Failed to download GitHub image attachment Image #1.');
    expect(message).not.toContain('secret-token');
    expect(message).not.toContain('private-user-images.githubusercontent.com/123/asset.png');
  });

  it('should not expose signed private image URLs when validation fails', async () => {
    const imageUrl = 'https://private-user-images.githubusercontent.com/123/asset.png?token=secret-token';
    const prReview = createMockPrReview({
      body: `Private image ![image](${imageUrl})`,
    });
    mockGitHubAttachmentDownload({
      [imageUrl]: { contentType: 'image/jpeg', body: PNG_DATA },
    });

    let message = '';
    try {
      await resolvePrReviewImageAttachments(prReview, testDir);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('GitHub image Content-Type does not match magic bytes for Image #1');
    expect(message).not.toContain('secret-token');
    expect(message).not.toContain('private-user-images.githubusercontent.com/123/asset.png');
  });

  it('should reject allowlisted images over the configured byte limit from Content-Length', async () => {
    const imageUrl = 'https://github.com/user-attachments/assets/too-large';
    const prReview = createMockPrReview({
      body: `Large image ![image](${imageUrl})`,
    });
    mockGitHubAttachmentDownload({
      [imageUrl]: {
        contentType: 'image/png',
        body: PNG_DATA,
        headers: { 'content-length': String(MAX_PR_IMAGE_ATTACHMENT_BYTES + 1) },
      },
    });

    await expect(resolvePrReviewImageAttachments(prReview, testDir)).rejects.toThrow(
      `exceeds the ${MAX_PR_IMAGE_ATTACHMENT_BYTES} byte limit`,
    );
  });

  it('should timeout stalled GitHub image downloads without leaking URLs and cleanup temp files', async () => {
    const imageUrl = 'https://private-user-images.githubusercontent.com/123/asset.png?token=secret-token';
    const prReview = createMockPrReview({
      body: `Stalled image ![image](${imageUrl})`,
    });
    const beforeTempRoots = listPrImageTempRoots();
    let configuredTimeout = 0;
    mockGhAuthToken();
    mockHttpsRequest.mockImplementation(() => {
      const request = new EventEmitter() as EventEmitter & {
        end: () => void;
        destroy: (error?: Error) => void;
        setTimeout: (milliseconds: number, callback: () => void) => void;
      };
      request.setTimeout = (milliseconds: number, callback: () => void) => {
        configuredTimeout = milliseconds;
        callback();
      };
      request.end = () => undefined;
      request.destroy = (error?: Error) => {
        request.emit('error', error);
      };
      return request;
    });

    let message = '';
    try {
      await resolvePrReviewImageAttachments(prReview, testDir);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(configuredTimeout).toBe(PR_IMAGE_ATTACHMENT_DOWNLOAD_TIMEOUT_MS);
    expect(message).toBe('GitHub image attachment request timed out for Image #1.');
    expect(message).not.toContain('secret-token');
    expect(message).not.toContain('private-user-images.githubusercontent.com/123/asset.png');
    expect(listPrImageTempRoots()).toEqual(beforeTempRoots);
  });

  it('should reject GitHub image redirects without Location and cleanup temp files', async () => {
    const imageUrl = 'https://private-user-images.githubusercontent.com/123/asset.png?token=secret-token';
    const prReview = createMockPrReview({
      body: `Redirect image ![image](${imageUrl})`,
    });
    const beforeTempRoots = listPrImageTempRoots();
    mockGhAuthToken();
    mockHttpsRequest.mockImplementation((_options: MockHttpsRequestOptions, callback: (response: MockHttpsResponse) => void) => {
      const response = new PassThrough() as MockHttpsResponse;
      response.statusCode = 302;
      response.headers = {};
      return createMockHttpsRequestHandle(() => {
        callback(response);
        response.end();
      });
    });

    let message = '';
    try {
      await resolvePrReviewImageAttachments(prReview, testDir);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe('GitHub image redirect is missing Location for Image #1.');
    expect(message).not.toContain('secret-token');
    expect(message).not.toContain('private-user-images.githubusercontent.com/123/asset.png');
    expect(listPrImageTempRoots()).toEqual(beforeTempRoots);
  });

  it('should reject GitHub image redirects outside allowed attachment hosts and cleanup temp files', async () => {
    const imageUrl = 'https://github.com/user-attachments/assets/redirect-outside';
    const prReview = createMockPrReview({
      body: `Redirect image ![image](${imageUrl})`,
    });
    const beforeTempRoots = listPrImageTempRoots();
    mockGhAuthToken();
    mockHttpsRequest.mockImplementation((_options: MockHttpsRequestOptions, callback: (response: MockHttpsResponse) => void) => {
      const response = new PassThrough() as MockHttpsResponse;
      response.statusCode = 302;
      response.headers = { location: 'https://example.com/asset.png' };
      return createMockHttpsRequestHandle(() => {
        callback(response);
        response.end();
      });
    });

    await expect(resolvePrReviewImageAttachments(prReview, testDir)).rejects.toThrow(
      'GitHub image redirect points outside allowed attachment hosts for Image #1.',
    );
    expect(listPrImageTempRoots()).toEqual(beforeTempRoots);
  });

  it('should reject GitHub image redirects over the configured redirect limit and cleanup temp files', async () => {
    const imageUrl = 'https://github.com/user-attachments/assets/redirect-loop';
    const prReview = createMockPrReview({
      body: `Redirect image ![image](${imageUrl})`,
    });
    const beforeTempRoots = listPrImageTempRoots();
    let requestCount = 0;
    mockGhAuthToken();
    mockHttpsRequest.mockImplementation((options: MockHttpsRequestOptions, callback: (response: MockHttpsResponse) => void) => {
      requestCount += 1;
      const response = new PassThrough() as MockHttpsResponse;
      response.statusCode = 302;
      response.headers = { location: `https://${options.hostname}${options.path}` };
      return createMockHttpsRequestHandle(() => {
        callback(response);
        response.end();
      });
    });

    await expect(resolvePrReviewImageAttachments(prReview, testDir)).rejects.toThrow(
      'GitHub image attachment exceeded redirect limit for Image #1.',
    );
    expect(requestCount).toBe(6);
    expect(listPrImageTempRoots()).toEqual(beforeTempRoots);
  });
});

function listPrImageTempRoots(): string[] {
  return fs.readdirSync(tmpdir())
    .filter((entry) => entry.startsWith('takt-pr-images-'))
    .sort();
}
