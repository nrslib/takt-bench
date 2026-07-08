import { EventEmitter } from 'node:events';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import type { ClientRequest, RequestOptions } from 'node:https';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExecFileSync, mockHttpsRequest } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
  mockHttpsRequest: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFileSync: mockExecFileSync,
}));

vi.mock('node:https', () => ({
  request: mockHttpsRequest,
}));

import {
  createGitHubAttachmentImageDownloader,
  downloadGitHubAttachmentImage,
} from '../infra/github/attachmentImage.js';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

interface MockResponseSpec {
  statusCode?: number;
  headers: IncomingHttpHeaders;
  chunks?: Buffer[];
  end?: boolean;
  triggerTimeout?: boolean;
}

interface RequestCall {
  url: string;
  headers: Record<string, string>;
}

class MockRequest extends EventEmitter {
  private readonly onEnd: () => void;
  private timeoutHandler: (() => void) | undefined;

  constructor(onEnd: () => void) {
    super();
    this.onEnd = onEnd;
  }

  end = vi.fn(() => {
    this.onEnd();
  });

  setTimeout = vi.fn((_timeoutMs: number, handler: () => void): this => {
    this.timeoutHandler = handler;
    return this;
  });

  destroy = vi.fn((error?: Error): this => {
    if (error) {
      this.emit('error', error);
    }
    return this;
  });

  triggerTimeout(): void {
    this.timeoutHandler?.();
  }
}

class MockResponse extends EventEmitter {
  statusCode: number | undefined;
  headers: IncomingHttpHeaders;
  resume = vi.fn();

  constructor(spec: MockResponseSpec) {
    super();
    this.statusCode = spec.statusCode;
    this.headers = spec.headers;
  }
}

const requestCalls: RequestCall[] = [];
const requests: MockRequest[] = [];

function enqueueResponse(spec: MockResponseSpec): void {
  mockHttpsRequest.mockImplementationOnce((
    url: string | URL,
    options: RequestOptions,
    callback: (response: IncomingMessage) => void,
  ) => {
    const request = new MockRequest(() => {
      const response = new MockResponse(spec);
      callback(response as unknown as IncomingMessage);
      for (const chunk of spec.chunks ?? []) {
        response.emit('data', chunk);
      }
      if (spec.triggerTimeout) {
        request.triggerTimeout();
        return;
      }
      if (spec.end !== false) {
        response.emit('end');
      }
    });
    requests.push(request);
    requestCalls.push({
      url: String(url),
      headers: options.headers as Record<string, string>,
    });
    return request as unknown as ClientRequest;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requestCalls.length = 0;
  requests.length = 0;
  mockExecFileSync.mockReturnValue('secret-token\n');
});

describe('downloadGitHubAttachmentImage', () => {
  it('should resolve the GitHub token with cwd and send Authorization to github.com', async () => {
    enqueueResponse({
      statusCode: 200,
      headers: { 'content-type': 'image/png' },
      chunks: [PNG_BYTES],
    });

    const result = await downloadGitHubAttachmentImage('https://github.com/user-attachments/assets/abc', {
      cwd: '/repo',
      maxBytes: 1024,
    });

    expect(mockExecFileSync).toHaveBeenCalledWith('gh', ['auth', 'token'], expect.objectContaining({
      cwd: '/repo',
    }));
    expect(requestCalls[0]).toEqual({
      url: 'https://github.com/user-attachments/assets/abc',
      headers: {
        'User-Agent': 'takt-cli',
        Authorization: 'Bearer secret-token',
      },
    });
    expect(result).toMatchObject({
      body: PNG_BYTES,
      contentType: 'image/png',
      finalUrl: 'https://github.com/user-attachments/assets/abc',
    });
  });

  it('should not forward Authorization to a redirected CDN host', async () => {
    enqueueResponse({
      statusCode: 302,
      headers: { location: 'https://user-images.githubusercontent.com/asset.png?sig=private' },
    });
    enqueueResponse({
      statusCode: 200,
      headers: { 'content-type': 'image/png' },
      chunks: [PNG_BYTES],
    });

    await downloadGitHubAttachmentImage('https://github.com/user-attachments/assets/abc', {
      cwd: '/repo',
      maxBytes: 1024,
    });

    expect(requestCalls[0]?.headers.Authorization).toBe('Bearer secret-token');
    expect(requestCalls[1]).toEqual({
      url: 'https://user-images.githubusercontent.com/asset.png?sig=private',
      headers: {
        'User-Agent': 'takt-cli',
      },
    });
  });

  it('should reject non-GitHub redirects without leaking signed query strings', async () => {
    enqueueResponse({
      statusCode: 302,
      headers: { location: 'https://example.com/asset.png?sig=private-token#fragment' },
    });

    const error = await downloadGitHubAttachmentImage('https://github.com/user-attachments/assets/abc?secret=source', {
      cwd: '/repo',
      maxBytes: 1024,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('https://example.com/asset.png');
    expect((error as Error).message).not.toContain('private-token');
  });

  it('should reject HTTP failures without leaking signed query strings', async () => {
    enqueueResponse({
      statusCode: 404,
      headers: { 'content-type': 'text/plain' },
    });

    const error = await downloadGitHubAttachmentImage('https://github.com/user-attachments/assets/missing?sig=private', {
      cwd: '/repo',
      maxBytes: 1024,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('HTTP status 404');
    expect((error as Error).message).toContain('https://github.com/user-attachments/assets/missing');
    expect((error as Error).message).not.toContain('sig=private');
  });

  it('should reject responses that are missing an HTTP status code without using an unknown fallback', async () => {
    enqueueResponse({
      headers: { 'content-type': 'image/png' },
    });

    const error = await downloadGitHubAttachmentImage(
      'https://github.com/user-attachments/assets/missing-status?sig=private',
      {
        cwd: '/repo',
        maxBytes: 1024,
      },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      'GitHub attachment response is missing HTTP status code: https://github.com/user-attachments/assets/missing-status',
    );
    expect((error as Error).message).not.toContain('unknown');
    expect((error as Error).message).not.toContain('sig=private');
  });

  it('should reject responses without Content-Type', async () => {
    enqueueResponse({
      statusCode: 200,
      headers: {},
      chunks: [PNG_BYTES],
    });

    await expect(downloadGitHubAttachmentImage('https://github.com/user-attachments/assets/no-content-type', {
      cwd: '/repo',
      maxBytes: 1024,
    })).rejects.toThrow('content-type');
  });

  it('should abort when streaming exceeds maxBytes', async () => {
    enqueueResponse({
      statusCode: 200,
      headers: { 'content-type': 'image/png' },
      chunks: [PNG_BYTES, Buffer.alloc(32)],
    });

    await expect(downloadGitHubAttachmentImage('https://github.com/user-attachments/assets/large?sig=private', {
      cwd: '/repo',
      maxBytes: PNG_BYTES.length,
    })).rejects.toThrow('byte limit');
    expect(requests[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  it('should abort stalled downloads on timeout', async () => {
    enqueueResponse({
      statusCode: 200,
      headers: { 'content-type': 'image/png' },
      chunks: [PNG_BYTES],
      end: false,
      triggerTimeout: true,
    });

    await expect(downloadGitHubAttachmentImage('https://github.com/user-attachments/assets/stalled', {
      cwd: '/repo',
      maxBytes: 1024,
      timeoutMs: 10,
    })).rejects.toThrow('timed out after 10ms');
    expect(requests[0]?.destroy).toHaveBeenCalledTimes(1);
  });
});

describe('createGitHubAttachmentImageDownloader', () => {
  it('should reject non-GitHub URLs before resolving a GitHub token', async () => {
    const downloader = createGitHubAttachmentImageDownloader('/repo');

    await expect(downloader('https://example.com/asset.png?sig=private', {
      cwd: '/other',
      maxBytes: 1024,
    })).rejects.toThrow('Refusing to download non-GitHub attachment URL: https://example.com/asset.png');

    expect(mockExecFileSync).not.toHaveBeenCalled();
    expect(mockHttpsRequest).not.toHaveBeenCalled();
  });

  it('should resolve the GitHub token once for multiple downloads', async () => {
    enqueueResponse({
      statusCode: 200,
      headers: { 'content-type': 'image/png' },
      chunks: [PNG_BYTES],
    });
    enqueueResponse({
      statusCode: 200,
      headers: { 'content-type': 'image/png' },
      chunks: [PNG_BYTES],
    });
    const downloader = createGitHubAttachmentImageDownloader('/repo');

    await downloader('https://github.com/user-attachments/assets/one', { cwd: '/other', maxBytes: 1024 });
    await downloader('https://github.com/user-attachments/assets/two', { cwd: '/other', maxBytes: 1024 });

    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    expect(mockExecFileSync).toHaveBeenCalledWith('gh', ['auth', 'token'], expect.objectContaining({
      cwd: '/repo',
    }));
  });
});
