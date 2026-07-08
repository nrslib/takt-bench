import { describe, expect, it, vi } from 'vitest';

const { mockDebugLog } = vi.hoisted(() => ({
  mockDebugLog: vi.fn(),
}));

vi.mock('../shared/utils/index.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../shared/utils/index.js')>(),
  debugLog: (...args: unknown[]) => mockDebugLog(...args),
}));

import {
  downloadGitHubImageAttachment,
  isAllowedGitHubAttachmentUrl,
} from '../infra/github/attachmentDownload.js';
import { MAX_IMAGE_ATTACHMENT_BYTES } from '../shared/utils/imageMime.js';

const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpegData = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
const gifData = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(7, 0)]);
const webpData = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x04, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
]);

function createImageResponse(data: Buffer, contentType: string): Response {
  return new Response(data, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(data.length),
    },
  });
}

function createCancelableBodyResponse(headers: HeadersInit, status = 200): {
  response: Response;
  cancel: ReturnType<typeof vi.fn>;
} {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(pngData);
    },
    cancel,
  });
  return {
    response: new Response(stream, { status, headers }),
    cancel,
  };
}

function createResponseWithFailingCancel(): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(pngData);
    },
    cancel() {
      throw new Error('cancel failed');
    },
  });
  return new Response(stream, {
    status: 404,
    headers: {
      'Content-Type': 'image/png',
    },
  });
}

describe('isAllowedGitHubAttachmentUrl', () => {
  it.each([
    'https://github.com/user-attachments/assets/abc123',
    'https://github.com/org/repo/assets/123456',
    'https://private-user-images.githubusercontent.com/123456/image.png',
    'https://user-images.githubusercontent.com/123456/image.png',
  ])('should allow GitHub attachment URL: %s', (url) => {
    expect(isAllowedGitHubAttachmentUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com/image.png',
    'https://github.com/org/repo/issues/1',
    'https://github.com/org/repo/pull/1',
    'not-a-url',
  ])('should reject non-attachment URL: %s', (url) => {
    expect(isAllowedGitHubAttachmentUrl(url)).toBe(false);
  });
});

describe('downloadGitHubImageAttachment', () => {
  it.each([
    ['PNG', pngData, 'image/png', { mimeType: 'image/png', extension: 'png' }],
    ['JPEG', jpegData, 'image/jpeg', { mimeType: 'image/jpeg', extension: 'jpg' }],
    ['GIF', gifData, 'image/gif', { mimeType: 'image/gif', extension: 'gif' }],
    ['WebP', webpData, 'image/webp', { mimeType: 'image/webp', extension: 'webp' }],
  ])('should download %s attachments with an authenticated GitHub request', async (_label, data, contentType, expected) => {
    const fetchAttachment = vi.fn(async () => createImageResponse(data, contentType));
    const resolveAuthToken = vi.fn(() => 'github-token');

    const result = await downloadGitHubImageAttachment(
      'https://github.com/user-attachments/assets/abc123',
      {
        cwd: '/repo',
        fetch: fetchAttachment,
        resolveAuthToken,
      },
    );

    expect(result).toEqual({ data, ...expected });
    expect(resolveAuthToken).toHaveBeenCalledWith('github.com', '/repo');
    expect(fetchAttachment).toHaveBeenCalledWith(
      'https://github.com/user-attachments/assets/abc123',
      expect.objectContaining({
        redirect: 'manual',
        headers: expect.objectContaining({
          authorization: 'Bearer github-token',
        }),
      }),
    );
  });

  it('should reject disallowed source URLs before making a network request', async () => {
    const fetchAttachment = vi.fn();
    const resolveAuthToken = vi.fn();

    await expect(downloadGitHubImageAttachment(
      'https://example.com/image.png',
      {
        cwd: '/repo',
        fetch: fetchAttachment,
        resolveAuthToken,
      },
    )).rejects.toThrow('Unsupported GitHub attachment URL: https://example.com/image.png');

    expect(resolveAuthToken).not.toHaveBeenCalled();
    expect(fetchAttachment).not.toHaveBeenCalled();
  });

  it('should reject redirects to URLs outside the GitHub attachment allowlist', async () => {
    const { response, cancel } = createCancelableBodyResponse({
      Location: 'https://example.com/redirected.png',
    }, 302);
    const fetchAttachment = vi.fn(async () => new Response(null, {
      status: 302,
      headers: {
        Location: 'https://example.com/redirected.png',
      },
    })).mockResolvedValueOnce(response);

    await expect(downloadGitHubImageAttachment(
      'https://github.com/user-attachments/assets/abc123',
      {
        cwd: '/repo',
        fetch: fetchAttachment,
        resolveAuthToken: () => 'github-token',
      },
    )).rejects.toThrow('Unsupported GitHub attachment redirect URL: https://example.com/redirected.png');

    expect(fetchAttachment).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('should reject Content-Length above the configured image attachment limit before reading the body', async () => {
    const { response, cancel } = createCancelableBodyResponse({
        'Content-Type': 'image/png',
        'Content-Length': String(MAX_IMAGE_ATTACHMENT_BYTES + 1),
    });
    const fetchAttachment = vi.fn(async () => response);

    await expect(downloadGitHubImageAttachment(
      'https://github.com/user-attachments/assets/abc123',
      {
        cwd: '/repo',
        fetch: fetchAttachment,
        resolveAuthToken: () => 'github-token',
      },
    )).rejects.toThrow(`GitHub image attachment exceeds the ${MAX_IMAGE_ATTACHMENT_BYTES} byte limit.`);

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('should stop reading streamed bodies above the configured image attachment limit', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(Buffer.alloc(MAX_IMAGE_ATTACHMENT_BYTES, 0));
        controller.enqueue(Buffer.from([0]));
      },
      cancel,
    });
    const fetchAttachment = vi.fn(async () => new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
      },
    }));

    await expect(downloadGitHubImageAttachment(
      'https://github.com/user-attachments/assets/abc123',
      {
        cwd: '/repo',
        fetch: fetchAttachment,
        resolveAuthToken: () => 'github-token',
      },
    )).rejects.toThrow(`GitHub image attachment exceeds the ${MAX_IMAGE_ATTACHMENT_BYTES} byte limit.`);

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('should reject unsupported Content-Type before reading the body', async () => {
    const { response, cancel } = createCancelableBodyResponse({
      'Content-Type': 'image/svg+xml',
    });
    const fetchAttachment = vi.fn(async () => response);

    await expect(downloadGitHubImageAttachment(
      'https://github.com/user-attachments/assets/abc123',
      {
        cwd: '/repo',
        fetch: fetchAttachment,
        resolveAuthToken: () => 'github-token',
      },
    )).rejects.toThrow('Unsupported image Content-Type: image/svg+xml');

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('should cancel failed response bodies before throwing', async () => {
    const { response, cancel } = createCancelableBodyResponse({
      'Content-Type': 'image/png',
    }, 404);
    const fetchAttachment = vi.fn(async () => response);

    await expect(downloadGitHubImageAttachment(
      'https://github.com/user-attachments/assets/abc123',
      {
        cwd: '/repo',
        fetch: fetchAttachment,
        resolveAuthToken: () => 'github-token',
      },
    )).rejects.toThrow('Failed to download GitHub image attachment: HTTP 404');

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('should log response body cleanup failures while preserving the download error', async () => {
    const fetchAttachment = vi.fn(async () => createResponseWithFailingCancel());

    await expect(downloadGitHubImageAttachment(
      'https://github.com/user-attachments/assets/abc123',
      {
        cwd: '/repo',
        fetch: fetchAttachment,
        resolveAuthToken: () => 'github-token',
      },
    )).rejects.toThrow('Failed to download GitHub image attachment: HTTP 404');

    expect(mockDebugLog).toHaveBeenCalledWith(
      'github',
      'Failed to cancel GitHub image attachment response body',
      'cancel failed',
    );
  });

  it.each([
    'https://user-images.githubusercontent.com/123/image.png',
    'https://private-user-images.githubusercontent.com/123/image.png',
  ])('should fetch direct asset host URLs without resolving unused GitHub tokens: %s', async (url) => {
    const fetchAttachment = vi.fn(async () => createImageResponse(pngData, 'image/png'));
    const resolveAuthToken = vi.fn(() => 'github-token');

    const result = await downloadGitHubImageAttachment(
      url,
      {
        cwd: '/repo',
        fetch: fetchAttachment,
        resolveAuthToken,
      },
    );

    expect(result).toEqual({ data: pngData, mimeType: 'image/png', extension: 'png' });
    expect(resolveAuthToken).not.toHaveBeenCalled();
    expect(fetchAttachment).toHaveBeenCalledWith(
      url,
      expect.not.objectContaining({
        headers: expect.anything(),
      }),
    );
  });

  it('should not forward GitHub Authorization to redirected asset hosts', async () => {
    const fetchAttachment = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: {
          Location: 'https://private-user-images.githubusercontent.com/123/image.png',
        },
      }))
      .mockResolvedValueOnce(createImageResponse(pngData, 'image/png'));

    await downloadGitHubImageAttachment(
      'https://github.com/user-attachments/assets/abc123',
      {
        cwd: '/repo',
        fetch: fetchAttachment,
        resolveAuthToken: () => 'github-token',
      },
    );

    expect(fetchAttachment).toHaveBeenNthCalledWith(
      1,
      'https://github.com/user-attachments/assets/abc123',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer github-token' }),
      }),
    );
    expect(fetchAttachment).toHaveBeenNthCalledWith(
      2,
      'https://private-user-images.githubusercontent.com/123/image.png',
      expect.not.objectContaining({
        headers: expect.anything(),
      }),
    );
  });

  it('should cancel redirect response bodies when Location is missing', async () => {
    const { response, cancel } = createCancelableBodyResponse({}, 302);
    const fetchAttachment = vi.fn(async () => response);

    await expect(downloadGitHubImageAttachment(
      'https://github.com/user-attachments/assets/abc123',
      {
        cwd: '/repo',
        fetch: fetchAttachment,
        resolveAuthToken: () => 'github-token',
      },
    )).rejects.toThrow('GitHub image attachment redirect is missing Location');

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('should cancel response bodies when Content-Length parsing fails', async () => {
    const { response, cancel } = createCancelableBodyResponse({
      'Content-Type': 'image/png',
      'Content-Length': 'not-a-number',
    });
    const fetchAttachment = vi.fn(async () => response);

    await expect(downloadGitHubImageAttachment(
      'https://github.com/user-attachments/assets/abc123',
      {
        cwd: '/repo',
        fetch: fetchAttachment,
        resolveAuthToken: () => 'github-token',
      },
    )).rejects.toThrow('Invalid GitHub image attachment Content-Length: not-a-number');

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('should reject images when Content-Type and magic bytes disagree', async () => {
    const fetchAttachment = vi.fn(async () => createImageResponse(pngData, 'image/jpeg'));

    await expect(downloadGitHubImageAttachment(
      'https://github.com/user-attachments/assets/abc123',
      {
        cwd: '/repo',
        fetch: fetchAttachment,
        resolveAuthToken: () => 'github-token',
      },
    )).rejects.toThrow('Image Content-Type does not match image data: image/jpeg !== image/png');
  });
});
