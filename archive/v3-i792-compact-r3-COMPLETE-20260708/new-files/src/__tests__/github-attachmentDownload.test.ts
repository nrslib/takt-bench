import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  MAX_GITHUB_ATTACHMENT_IMAGE_BYTES,
  downloadGitHubAttachmentImage,
  isGitHubAttachmentUrl,
} from '../infra/github/attachmentDownload.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const mockExecFileSync = vi.mocked(execFileSync);
const mockFetch = vi.fn();

function responseWithHeaders(options: {
  contentType: string;
  contentLength?: string;
  body: Buffer;
}): {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  body: ReadableStream<Uint8Array>;
} {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name: string): string | null {
        if (name.toLowerCase() === 'content-type') return options.contentType;
        if (name.toLowerCase() === 'content-length') return options.contentLength ?? null;
        return null;
      },
    },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(options.body);
        controller.close();
      },
    }),
  };
}

function streamingResponseWithHeaders(options: {
  contentType: string;
  contentLength?: string;
  body: ReadableStream<Uint8Array>;
}): {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  body: ReadableStream<Uint8Array>;
} {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name: string): string | null {
        if (name.toLowerCase() === 'content-type') return options.contentType;
        if (name.toLowerCase() === 'content-length') return options.contentLength ?? null;
        return null;
      },
    },
    body: options.body,
  };
}

describe('GitHub attachment image download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFileSync.mockReturnValue('gh-token\n');
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should allow only GitHub attachment hosts and paths', () => {
    expect(isGitHubAttachmentUrl('https://github.com/user-attachments/assets/abc')).toBe(true);
    expect(isGitHubAttachmentUrl('https://github.com/org/repo/assets/123')).toBe(true);
    expect(isGitHubAttachmentUrl('https://user-images.githubusercontent.com/123456/reference.png')).toBe(true);
    expect(isGitHubAttachmentUrl('https://private-user-images.githubusercontent.com/123456/reference.png')).toBe(true);

    expect(isGitHubAttachmentUrl('https://github.com/org/repo/issues/1')).toBe(false);
    expect(isGitHubAttachmentUrl('https://example.com/image.png')).toBe(false);
    expect(isGitHubAttachmentUrl('http://github.com/user-attachments/assets/abc')).toBe(false);
  });

  it('should fetch allowed images with the authenticated gh token and return validated bytes', async () => {
    const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    mockFetch.mockResolvedValueOnce(responseWithHeaders({
      contentType: 'image/png',
      contentLength: String(pngData.length),
      body: pngData,
    }));

    const result = await downloadGitHubAttachmentImage(
      'https://github.com/user-attachments/assets/reference',
      '/repo',
    );

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['auth', 'token', '--hostname', 'github.com'],
      expect.objectContaining({ cwd: '/repo', encoding: 'utf-8' }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      'https://github.com/user-attachments/assets/reference',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer gh-token' }),
      }),
    );
    expect(result).toEqual({ data: pngData, mimeType: 'image/png' });
  });

  it('should reject content type and magic byte mismatches', async () => {
    mockFetch.mockResolvedValueOnce(responseWithHeaders({
      contentType: 'image/png',
      body: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    }));

    await expect(downloadGitHubAttachmentImage(
      'https://github.com/user-attachments/assets/reference',
      '/repo',
    )).rejects.toThrow('Downloaded image MIME does not match Content-Type');
  });

  it('should reject unsupported content types before treating the response as an attachment', async () => {
    mockFetch.mockResolvedValueOnce(responseWithHeaders({
      contentType: 'image/svg+xml',
      body: Buffer.from('<svg></svg>'),
    }));

    await expect(downloadGitHubAttachmentImage(
      'https://github.com/user-attachments/assets/reference',
      '/repo',
    )).rejects.toThrow('Unsupported GitHub attachment image Content-Type: image/svg+xml');
  });

  it('should reject oversized responses before reading the response body when Content-Length exceeds the limit', async () => {
    let bodyRead = false;
    const response = responseWithHeaders({
      contentType: 'image/png',
      contentLength: String(MAX_GITHUB_ATTACHMENT_IMAGE_BYTES + 1),
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });
    const responseWithUnreadableBody = {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      get body() {
        bodyRead = true;
        return new ReadableStream<Uint8Array>({
          pull() {
            throw new Error('body must not be read');
          },
        });
      },
    };
    mockFetch.mockResolvedValueOnce(responseWithUnreadableBody);

    await expect(downloadGitHubAttachmentImage(
      'https://github.com/user-attachments/assets/reference',
      '/repo',
    )).rejects.toThrow('GitHub attachment image exceeds the size limit');
    expect(bodyRead).toBe(false);
  });

  it.each(['1abc', '1, 1', '', ' '])(
    'should reject malformed Content-Length before reading the response body: %s',
    async (contentLength) => {
      let bodyRead = false;
      const response = responseWithHeaders({
        contentType: 'image/png',
        contentLength,
        body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      });
      const responseWithUnreadableBody = {
        ok: response.ok,
        status: response.status,
        headers: response.headers,
        get body() {
          bodyRead = true;
          return new ReadableStream<Uint8Array>({
            pull() {
              throw new Error('body must not be read');
            },
          });
        },
      };
      mockFetch.mockResolvedValueOnce(responseWithUnreadableBody);

      await expect(downloadGitHubAttachmentImage(
        'https://github.com/user-attachments/assets/reference',
        '/repo',
      )).rejects.toThrow(`Invalid GitHub attachment image Content-Length: ${contentLength}`);
      expect(bodyRead).toBe(false);
    },
  );

  it('should reject responses without a stream body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get(name: string): string | null {
          if (name.toLowerCase() === 'content-type') return 'image/png';
          if (name.toLowerCase() === 'content-length') return null;
          return null;
        },
      },
      body: null,
    });

    await expect(downloadGitHubAttachmentImage(
      'https://github.com/user-attachments/assets/reference',
      '/repo',
    )).rejects.toThrow('GitHub attachment image response body is missing');
  });

  it('should stop streaming when a response without Content-Length exceeds the size limit', async () => {
    let cancelCalled = false;
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) {
          controller.enqueue(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
          return;
        }
        if (pulls === 2) {
          controller.enqueue(new Uint8Array(MAX_GITHUB_ATTACHMENT_IMAGE_BYTES));
          return;
        }
        controller.enqueue(new Uint8Array([0x00]));
      },
      cancel() {
        cancelCalled = true;
      },
    });
    mockFetch.mockResolvedValueOnce(streamingResponseWithHeaders({
      contentType: 'image/png',
      body,
    }));

    await expect(downloadGitHubAttachmentImage(
      'https://github.com/user-attachments/assets/reference',
      '/repo',
    )).rejects.toThrow('GitHub attachment image exceeds the size limit');
    expect(cancelCalled).toBe(true);
    expect(pulls).toBeGreaterThanOrEqual(2);
  });

  it('should not fetch non-allowlisted image URLs', async () => {
    await expect(downloadGitHubAttachmentImage('https://example.com/reference.png', '/repo'))
      .rejects.toThrow('Unsupported GitHub attachment URL: https://example.com/reference.png');

    expect(mockExecFileSync).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
