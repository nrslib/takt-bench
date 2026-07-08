import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type * as https from 'node:https';
import { describe, expect, it, vi } from 'vitest';
import {
  createGithubAttachmentImageDownloader,
  type GithubAttachmentHttpsGet,
} from '../infra/github/attachmentImageDownloader.js';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

interface FakeResponseSpec {
  statusCode?: number;
  headers: IncomingMessage['headers'];
  chunks?: Buffer[];
}

class FakeRequest extends EventEmitter {
  destroy(error?: Error): void {
    if (error) {
      this.emit('error', error);
    }
  }
}

class FakeResponse extends EventEmitter {
  statusCode?: number;
  headers: IncomingMessage['headers'];
  resumed = false;
  destroyed = false;

  constructor(spec: FakeResponseSpec) {
    super();
    this.statusCode = spec.statusCode;
    this.headers = spec.headers;
  }

  resume(): void {
    this.resumed = true;
  }

  destroy(): this {
    this.destroyed = true;
    return this;
  }
}

function createHttpsGet(responses: FakeResponseSpec[]): {
  httpsGet: GithubAttachmentHttpsGet;
  calls: Array<{ url: string; options: https.RequestOptions }>;
} {
  const calls: Array<{ url: string; options: https.RequestOptions }> = [];
  const httpsGet = vi.fn<GithubAttachmentHttpsGet>((url, options, callback) => {
    calls.push({ url, options });
    const spec = responses.shift();
    if (!spec) {
      throw new Error(`Unexpected request: ${url}`);
    }
    const request = new FakeRequest();
    const response = new FakeResponse(spec);
    process.nextTick(() => {
      callback(response as unknown as IncomingMessage);
      for (const chunk of spec.chunks ?? []) {
        response.emit('data', chunk);
      }
      response.emit('end');
    });
    return request as unknown as ClientRequest;
  });
  return { httpsGet, calls };
}

describe('createGithubAttachmentImageDownloader', () => {
  it('downloads an allowed GitHub attachment with gh token authorization', async () => {
    const { httpsGet, calls } = createHttpsGet([
      {
        statusCode: 200,
        headers: { 'content-type': 'image/png' },
        chunks: [PNG_BYTES],
      },
    ]);
    const downloader = createGithubAttachmentImageDownloader({
      getAuthToken: vi.fn(() => 'token-123'),
      httpsGet,
    });

    const result = await downloader('https://github.com/user-attachments/assets/asset-1', {
      cwd: '/repo',
      maxBytes: 1024,
    });

    expect(result.body).toEqual(PNG_BYTES);
    expect(result.contentType).toBe('image/png');
    expect(calls[0]?.options.headers).toMatchObject({
      Authorization: 'Bearer token-123',
      'User-Agent': 'takt-pr-review-image-attachments',
    });
  });

  it('rejects an empty gh auth token before making an HTTP request', async () => {
    const { httpsGet } = createHttpsGet([]);
    const downloader = createGithubAttachmentImageDownloader({
      getAuthToken: vi.fn(() => ''),
      httpsGet,
    });

    await expect(downloader('https://github.com/user-attachments/assets/asset-1', {
      maxBytes: 1024,
    })).rejects.toThrow('gh auth token returned an empty token.');
    expect(httpsGet).not.toHaveBeenCalled();
  });

  it('follows allowed redirects', async () => {
    const finalUrl = 'https://github.com/user-attachments/assets/redirected';
    const { httpsGet } = createHttpsGet([
      {
        statusCode: 302,
        headers: { location: finalUrl },
      },
      {
        statusCode: 200,
        headers: { 'content-type': 'image/png' },
        chunks: [PNG_BYTES],
      },
    ]);
    const downloader = createGithubAttachmentImageDownloader({
      getAuthToken: vi.fn(() => 'token-123'),
      httpsGet,
    });

    const result = await downloader('https://github.com/user-attachments/assets/asset-1', {
      maxBytes: 1024,
    });

    expect(result.finalUrl).toBe(finalUrl);
    expect(httpsGet).toHaveBeenCalledTimes(2);
  });

  it('rejects redirects outside the allowlist without exposing signed query values', async () => {
    const { httpsGet } = createHttpsGet([
      {
        statusCode: 302,
        headers: { location: 'https://example.com/leak.png?token=secret-token' },
      },
    ]);
    const downloader = createGithubAttachmentImageDownloader({
      getAuthToken: vi.fn(() => 'token-123'),
      httpsGet,
    });

    let caught: unknown;
    try {
      await downloader('https://github.com/user-attachments/assets/asset-1', {
        maxBytes: 1024,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toContain('https://example.com/leak.png');
    expect(message).not.toContain('secret-token');
  });

  it('rejects redirect loops after the configured redirect limit', async () => {
    const responses = Array.from({ length: 6 }, () => ({
      statusCode: 302,
      headers: { location: 'https://github.com/user-attachments/assets/asset-1' },
    }));
    const { httpsGet } = createHttpsGet(responses);
    const downloader = createGithubAttachmentImageDownloader({
      getAuthToken: vi.fn(() => 'token-123'),
      httpsGet,
    });

    await expect(downloader('https://github.com/user-attachments/assets/asset-1', {
      maxBytes: 1024,
    })).rejects.toThrow('Too many redirects while downloading PR image');
    expect(httpsGet).toHaveBeenCalledTimes(6);
  });

  it('classifies missing HTTP status separately from numeric HTTP failures', async () => {
    const { httpsGet } = createHttpsGet([{ headers: {} }]);
    const downloader = createGithubAttachmentImageDownloader({
      getAuthToken: vi.fn(() => 'token-123'),
      httpsGet,
    });

    await expect(downloader('https://github.com/user-attachments/assets/asset-1', {
      maxBytes: 1024,
    })).rejects.toThrow('Missing HTTP status code while downloading PR image');
  });

  it('rejects non-2xx responses without exposing signed URL query values', async () => {
    const { httpsGet } = createHttpsGet([
      {
        statusCode: 403,
        headers: { 'content-type': 'text/plain' },
      },
    ]);
    const downloader = createGithubAttachmentImageDownloader({
      getAuthToken: vi.fn(() => 'token-123'),
      httpsGet,
    });
    const signedUrl = 'https://private-user-images.githubusercontent.com/asset.png?token=secret-token#fragment';

    let caught: unknown;
    try {
      await downloader(signedUrl, { maxBytes: 1024 });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toBe('Failed to download PR image https://private-user-images.githubusercontent.com/asset.png: HTTP 403');
    expect(message).not.toContain('secret-token');
  });

  it('rejects successful responses that omit Content-Type', async () => {
    const { httpsGet } = createHttpsGet([
      {
        statusCode: 200,
        headers: {},
        chunks: [PNG_BYTES],
      },
    ]);
    const downloader = createGithubAttachmentImageDownloader({
      getAuthToken: vi.fn(() => 'token-123'),
      httpsGet,
    });

    await expect(downloader('https://github.com/user-attachments/assets/asset-1', {
      maxBytes: 1024,
    })).rejects.toThrow('Missing Content-Type for PR image');
  });

  it('rejects the response while streaming when maxBytes is exceeded', async () => {
    const { httpsGet } = createHttpsGet([
      {
        statusCode: 200,
        headers: { 'content-type': 'image/png' },
        chunks: [PNG_BYTES],
      },
    ]);
    const downloader = createGithubAttachmentImageDownloader({
      getAuthToken: vi.fn(() => 'token-123'),
      httpsGet,
    });

    await expect(downloader('https://github.com/user-attachments/assets/asset-1', {
      maxBytes: PNG_BYTES.length - 1,
    })).rejects.toThrow(`PR image exceeds the ${PNG_BYTES.length - 1} byte limit`);
  });

  it('does not expose signed URL query values from request errors', async () => {
    const httpsGet = vi.fn<GithubAttachmentHttpsGet>((_url, _options, _callback) => {
      const request = new FakeRequest();
      process.nextTick(() => {
        request.emit('error', new Error('connect failed for token=secret-token'));
      });
      return request as unknown as ClientRequest;
    });
    const downloader = createGithubAttachmentImageDownloader({
      getAuthToken: vi.fn(() => 'token-123'),
      httpsGet,
    });
    const signedUrl = 'https://private-user-images.githubusercontent.com/asset.png?token=secret-token';

    let caught: unknown;
    try {
      await downloader(signedUrl, { maxBytes: 1024 });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toBe('Network error while downloading PR image: https://private-user-images.githubusercontent.com/asset.png');
    expect(message).not.toContain('secret-token');
  });
});
