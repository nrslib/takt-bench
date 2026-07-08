import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadPrImageAttachments } from '../infra/github/prImageAttachments.js';
import { MAX_IMAGE_ATTACHMENT_BYTES } from '../shared/utils/imageAttachmentData.js';

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
}));

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

const tempRoots = new Set<string>();
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'takt-pr-images-test-'));
  tempRoots.add(root);
  return root;
}

function createFetchResponse(data: Buffer, contentType: string, contentLength: string | null = String(data.byteLength)): unknown {
  return {
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    }),
    headers: {
      get: (name: string) => {
        const lower = name.toLowerCase();
        if (lower === 'content-type') return contentType;
        if (lower === 'content-length') return contentLength;
        return null;
      },
    },
  };
}

function createRedirectResponse(location: string): unknown {
  return {
    ok: false,
    status: 302,
    body: null,
    headers: {
      get: (name: string) => name.toLowerCase() === 'location' ? location : null,
    },
  };
}

function createCancelableFetchResponse(input: {
  ok: boolean;
  status: number;
  contentLength?: string | null;
  contentType?: string | null;
  location?: string | null;
}): { response: unknown; cancelBody: ReturnType<typeof vi.fn> } {
  const cancelBody = vi.fn();
  return {
    response: {
      ok: input.ok,
      status: input.status,
      body: new ReadableStream<Uint8Array>({
        cancel: cancelBody,
      }),
      headers: {
        get: (name: string) => {
          const lower = name.toLowerCase();
          if (lower === 'content-type') return input.contentType ?? null;
          if (lower === 'content-length') return input.contentLength ?? null;
          if (lower === 'location') return input.location ?? null;
          return null;
        },
      },
    },
    cancelBody,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExecFileSync.mockReturnValue('test-token\n');
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.clear();
});

describe('downloadPrImageAttachments', () => {
  it('Given a GitHub image reference, When downloaded, Then gh auth token is used and a TaskAttachment is created', async () => {
    const tmpRoot = createTempRoot();
    const mockFetch = vi.fn().mockResolvedValue(createFetchResponse(pngBytes, 'image/png'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await downloadPrImageAttachments([
      {
        url: 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111',
        placeholder: '[Image #1]',
      },
    ], {
      cwd: '/repo',
      tmpRoot,
    });

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['auth', 'token'],
      expect.objectContaining({ cwd: '/repo', encoding: 'utf-8' }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        redirect: 'manual',
      }),
    );
    expect(result.attachments).toEqual([{
      placeholder: '[Image #1]',
      tempPath: expect.stringContaining(path.join('attachments', 'image-1.png')),
      fileName: 'image-1.png',
    }]);
    expect(fs.readFileSync(result.attachments[0]!.tempPath)).toEqual(pngBytes);

    result.cleanupAttachments();

    expect(fs.existsSync(result.attachments[0]!.tempPath)).toBe(false);
  });

  it('Given an external URL reference, When download is requested, Then no network request is sent', async () => {
    const tmpRoot = createTempRoot();
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await expect(downloadPrImageAttachments([
      { url: 'https://example.com/image.png', placeholder: '[Image #1]' },
    ], {
      cwd: '/repo',
      tmpRoot,
    })).rejects.toThrow(/Unsupported PR image attachment URL/i);

    expect(mockExecFileSync).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('Given a GitHub image redirects to an external URL, When download is requested, Then the redirect target is rejected before fetching it', async () => {
    const tmpRoot = createTempRoot();
    const mockFetch = vi.fn().mockResolvedValue(createRedirectResponse('https://example.com/redirected.png'));
    vi.stubGlobal('fetch', mockFetch);

    await expect(downloadPrImageAttachments([
      {
        url: 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111',
        placeholder: '[Image #1]',
      },
    ], {
      cwd: '/repo',
      tmpRoot,
    })).rejects.toThrow(/Unsupported PR image attachment URL/i);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('Given a redirect response has a body, When the redirect is rejected, Then the redirect body is canceled', async () => {
    const tmpRoot = createTempRoot();
    const { response, cancelBody } = createCancelableFetchResponse({
      ok: false,
      status: 302,
      location: 'https://example.com/redirected.png',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await expect(downloadPrImageAttachments([
      {
        url: 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111',
        placeholder: '[Image #1]',
      },
    ], {
      cwd: '/repo',
      tmpRoot,
    })).rejects.toThrow(/Unsupported PR image attachment URL/i);

    expect(cancelBody).toHaveBeenCalledTimes(1);
  });

  it('Given an HTTP error response has a body, When download fails, Then the response body is canceled', async () => {
    const tmpRoot = createTempRoot();
    const { response, cancelBody } = createCancelableFetchResponse({
      ok: false,
      status: 500,
      contentLength: '0',
      contentType: 'image/png',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await expect(downloadPrImageAttachments([
      {
        url: 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111',
        placeholder: '[Image #1]',
      },
    ], {
      cwd: '/repo',
      tmpRoot,
    })).rejects.toThrow(/HTTP 500/i);

    expect(cancelBody).toHaveBeenCalledTimes(1);
  });

  it('Given Content-Length exceeds the limit before reading, When download fails, Then the response body is canceled', async () => {
    const tmpRoot = createTempRoot();
    const { response, cancelBody } = createCancelableFetchResponse({
      ok: true,
      status: 200,
      contentLength: String(MAX_IMAGE_ATTACHMENT_BYTES + 1),
      contentType: 'image/png',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await expect(downloadPrImageAttachments([
      {
        url: 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111',
        placeholder: '[Image #1]',
      },
    ], {
      cwd: '/repo',
      tmpRoot,
    })).rejects.toThrow(/exceeds.*byte limit/i);

    expect(cancelBody).toHaveBeenCalledTimes(1);
  });

  it('Given Content-Type is missing before reading, When download fails, Then the response body is canceled', async () => {
    const tmpRoot = createTempRoot();
    const { response, cancelBody } = createCancelableFetchResponse({
      ok: true,
      status: 200,
      contentLength: '0',
      contentType: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await expect(downloadPrImageAttachments([
      {
        url: 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111',
        placeholder: '[Image #1]',
      },
    ], {
      cwd: '/repo',
      tmpRoot,
    })).rejects.toThrow(/Content-Type is required/i);

    expect(cancelBody).toHaveBeenCalledTimes(1);
  });

  it('Given Content-Length is missing and the stream exceeds the limit, When downloaded, Then reading stops with a size error', async () => {
    const tmpRoot = createTempRoot();
    const oversizedChunk = Buffer.alloc(MAX_IMAGE_ATTACHMENT_BYTES + 1);
    const mockFetch = vi.fn().mockResolvedValue(createFetchResponse(oversizedChunk, 'image/png', null));
    vi.stubGlobal('fetch', mockFetch);

    await expect(downloadPrImageAttachments([
      {
        url: 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111',
        placeholder: '[Image #1]',
      },
    ], {
      cwd: '/repo',
      tmpRoot,
    })).rejects.toThrow(/exceeds.*byte limit/i);
  });

});
