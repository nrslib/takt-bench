import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_IMAGE_ATTACHMENT_BYTES } from '../shared/utils/imageMime.js';
import {
  buildRedirectedGitHubAttachmentRequest,
  downloadGitHubImageAttachment,
  sanitizeGitHubAttachmentUrlForError,
} from '../infra/github/attachmentDownloads.js';

const PNG_DATA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_DATA = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GITHUB_ATTACHMENT_URL = 'https://github.com/user-attachments/assets/12345678-90ab-cdef';

const { mockHttpsGet } = vi.hoisted(() => ({
  mockHttpsGet: vi.fn(),
}));

vi.mock('node:https', () => ({
  get: mockHttpsGet,
}));

interface MockRequest extends EventEmitter {
  setTimeout: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

interface MockResponse extends EventEmitter {
  statusCode?: number;
  headers: IncomingHttpHeaders;
  resume: ReturnType<typeof vi.fn>;
}

function createMockRequest(): MockRequest {
  const request = new EventEmitter() as MockRequest;
  request.setTimeout = vi.fn(() => request);
  request.destroy = vi.fn((error?: Error) => {
    if (error !== undefined) {
      request.emit('error', error);
    }
  });
  return request;
}

function createMockResponse(statusCode: number | undefined, headers: IncomingHttpHeaders): MockResponse {
  const response = new EventEmitter() as MockResponse;
  response.statusCode = statusCode;
  response.headers = headers;
  response.resume = vi.fn();
  return response;
}

function mockHttpsGetWithResponse(response: MockResponse, request: MockRequest = createMockRequest()): void {
  mockHttpsGet.mockImplementation((_url: string | URL, _options: unknown, callback?: (res: IncomingMessage) => void): ClientRequest => {
    queueMicrotask(() => callback?.(response as unknown as IncomingMessage));
    return request as unknown as ClientRequest;
  });
}

afterEach(() => {
  vi.clearAllMocks();
  mockHttpsGet.mockReset();
});

afterAll(() => {
  vi.doUnmock('node:https');
});

describe('downloadGitHubImageAttachment', () => {
  it('Given a GitHub attachment PNG, When downloading it, Then it uses gh authentication and returns validated image data', async () => {
    const getAuthToken = vi.fn(() => 'gh-token');
    const fetchBinary = vi.fn(async () => ({
      data: PNG_DATA,
      contentType: 'image/png' as const,
    }));

    const attachment = await downloadGitHubImageAttachment({
      url: GITHUB_ATTACHMENT_URL,
      cwd: '/repo',
      getAuthToken,
      fetchBinary,
    });

    expect(getAuthToken).toHaveBeenCalledWith('/repo');
    const fetchRequest = fetchBinary.mock.calls[0]?.[0] as {
      url: string;
      headers: Record<string, string>;
      maxBytes: number;
      timeoutMs: number;
    };
    expect(fetchRequest.url).toBe(GITHUB_ATTACHMENT_URL);
    expect(fetchRequest.maxBytes).toBe(MAX_IMAGE_ATTACHMENT_BYTES);
    expect(fetchRequest.timeoutMs).toBeGreaterThan(0);
    const authorizationHeader = Object.entries(fetchRequest.headers)
      .find(([name]) => name.toLowerCase() === 'authorization')?.[1];
    expect(authorizationHeader).toBe('Bearer gh-token');
    expect(attachment).toEqual({
      data: PNG_DATA,
      contentType: 'image/png',
    });
  });

  it('Given an external image URL, When downloading it, Then it fails before token lookup or network access', async () => {
    const getAuthToken = vi.fn(() => 'gh-token');
    const fetchBinary = vi.fn();

    await expect(downloadGitHubImageAttachment({
      url: 'https://example.com/image.png?secret=token#fragment',
      cwd: '/repo',
      getAuthToken,
      fetchBinary,
    })).rejects.toThrow('Unsupported GitHub attachment URL: https://example.com/image.png');

    expect(getAuthToken).not.toHaveBeenCalled();
    expect(fetchBinary).not.toHaveBeenCalled();
  });

  it('Given a GitHub attachment redirect to an external host, When building the redirected request, Then it rejects before forwarding headers', () => {
    const request = {
      url: GITHUB_ATTACHMENT_URL,
      headers: {
        Authorization: 'Bearer gh-token',
      },
      maxBytes: MAX_IMAGE_ATTACHMENT_BYTES,
      timeoutMs: 30_000,
    };

    expect(() => buildRedirectedGitHubAttachmentRequest(
      request,
      'https://example.com/steal-token.png?sig=secret#fragment',
    )).toThrow('Unsupported GitHub attachment URL: https://example.com/steal-token.png');
  });

  it('Given a GitHub attachment redirect to an external host, When following the redirect, Then it rejects the promise instead of throwing outside it', async () => {
    const response = createMockResponse(302, {
      location: 'https://example.com/steal-token.png?sig=secret#fragment',
    });
    mockHttpsGetWithResponse(response);

    await expect(downloadGitHubImageAttachment({
      url: GITHUB_ATTACHMENT_URL,
      cwd: '/repo',
      getAuthToken: vi.fn(() => 'gh-token'),
    })).rejects.toThrow('Unsupported GitHub attachment URL: https://example.com/steal-token.png');

    expect(response.resume).toHaveBeenCalled();
  });

  it('Given a GitHub attachment redirect to an allowed attachment URL, When building the redirected request, Then it preserves the bounded request', () => {
    const request = {
      url: GITHUB_ATTACHMENT_URL,
      headers: {
        Authorization: 'Bearer gh-token',
      },
      maxBytes: MAX_IMAGE_ATTACHMENT_BYTES,
      timeoutMs: 30_000,
    };

    expect(buildRedirectedGitHubAttachmentRequest(
      request,
      '/user-attachments/assets/redirected-image',
    )).toEqual({
      ...request,
      url: 'https://github.com/user-attachments/assets/redirected-image',
    });
  });

  it('Given a GitHub asset URL under a repository, When downloading it, Then the allowlist accepts the URL', async () => {
    const getAuthToken = vi.fn(() => 'gh-token');
    const fetchBinary = vi.fn(async () => ({
      data: JPEG_DATA,
      contentType: 'image/jpeg' as const,
    }));

    const attachment = await downloadGitHubImageAttachment({
      url: 'https://github.com/org/repo/assets/12345',
      cwd: '/repo',
      getAuthToken,
      fetchBinary,
    });

    expect(attachment).toEqual({
      data: JPEG_DATA,
      contentType: 'image/jpeg',
    });
  });

  it('Given a Content-Type and bytes mismatch, When downloading it, Then it rejects the attachment', async () => {
    const fetchBinary = vi.fn(async () => ({
      data: JPEG_DATA,
      contentType: 'image/png' as const,
    }));

    await expect(downloadGitHubImageAttachment({
      url: GITHUB_ATTACHMENT_URL,
      cwd: '/repo',
      getAuthToken: vi.fn(() => 'gh-token'),
      fetchBinary,
    })).rejects.toThrow('Image Content-Type does not match image data');
  });

  it('Given data larger than the image attachment limit, When downloading it, Then it rejects the attachment', async () => {
    const fetchBinary = vi.fn(async () => ({
      data: Buffer.alloc(MAX_IMAGE_ATTACHMENT_BYTES + 1, 0),
      contentType: 'image/png' as const,
    }));

    await expect(downloadGitHubImageAttachment({
      url: GITHUB_ATTACHMENT_URL,
      cwd: '/repo',
      getAuthToken: vi.fn(() => 'gh-token'),
      fetchBinary,
    })).rejects.toThrow(`GitHub image attachment exceeds the ${MAX_IMAGE_ATTACHMENT_BYTES} byte limit.`);
  });

  it('Given a private image URL with signed query, When an HTTP failure is reported, Then the error omits query and hash', async () => {
    const privateImageUrl = 'https://private-user-images.githubusercontent.com/123/456.png?X-Amz-Signature=secret#fragment';
    mockHttpsGetWithResponse(createMockResponse(403, {}));

    await expect(downloadGitHubImageAttachment({
      url: privateImageUrl,
      cwd: '/repo',
      getAuthToken: vi.fn(() => 'gh-token'),
    })).rejects.toThrow('GitHub attachment download failed with HTTP status 403: https://private-user-images.githubusercontent.com/123/456.png');

    await expect(downloadGitHubImageAttachment({
      url: privateImageUrl,
      cwd: '/repo',
      getAuthToken: vi.fn(() => 'gh-token'),
    })).rejects.not.toThrow('X-Amz-Signature');
  });

  it('Given a non-image Content-Type response, When headers arrive, Then it rejects before reading body data', async () => {
    const response = createMockResponse(200, {
      'content-type': 'text/html; charset=utf-8',
    });
    mockHttpsGetWithResponse(response);

    await expect(downloadGitHubImageAttachment({
      url: GITHUB_ATTACHMENT_URL,
      cwd: '/repo',
      getAuthToken: vi.fn(() => 'gh-token'),
    })).rejects.toThrow('Unsupported image Content-Type: text/html');

    expect(response.resume).toHaveBeenCalled();
    expect(response.listenerCount('data')).toBe(0);
  });

  it('Given a response stream error during body read, When the response emits error, Then the download rejects through the promise boundary', async () => {
    const response = createMockResponse(200, {
      'content-type': 'image/png',
    });
    mockHttpsGetWithResponse(response);

    const promise = downloadGitHubImageAttachment({
      url: GITHUB_ATTACHMENT_URL,
      cwd: '/repo',
      getAuthToken: vi.fn(() => 'gh-token'),
    });
    await Promise.resolve();
    response.emit('error', new Error('response stream failed'));

    await expect(promise).rejects.toThrow('response stream failed');
  });

  it('Given a response without HTTP status, When headers arrive, Then it rejects with an explicit sanitized error', async () => {
    const privateImageUrl = 'https://private-user-images.githubusercontent.com/123/456.png?X-Amz-Signature=secret#fragment';
    const response = createMockResponse(undefined, {});
    mockHttpsGetWithResponse(response);

    await expect(downloadGitHubImageAttachment({
      url: privateImageUrl,
      cwd: '/repo',
      getAuthToken: vi.fn(() => 'gh-token'),
    })).rejects.toThrow('GitHub attachment response missing HTTP status: https://private-user-images.githubusercontent.com/123/456.png');

    expect(response.resume).toHaveBeenCalled();
  });

  it('Given a GitHub attachment request stalls, When the timeout fires, Then it rejects with a sanitized timeout error', async () => {
    let timeoutHandler: (() => void) | undefined;
    const request = createMockRequest();
    request.setTimeout.mockImplementation((_timeoutMs: number, handler: () => void) => {
      timeoutHandler = handler;
      return request;
    });
    mockHttpsGet.mockImplementation((_url: string | URL): ClientRequest => request as unknown as ClientRequest);

    const promise = downloadGitHubImageAttachment({
      url: 'https://private-user-images.githubusercontent.com/123/456.png?X-Amz-Signature=secret',
      cwd: '/repo',
      getAuthToken: vi.fn(() => 'gh-token'),
    });
    expect(timeoutHandler).toBeDefined();
    timeoutHandler?.();

    await expect(promise).rejects.toThrow('GitHub attachment download timed out: https://private-user-images.githubusercontent.com/123/456.png');
  });
});

describe('sanitizeGitHubAttachmentUrlForError', () => {
  it('Given a URL with query and hash, When sanitizing for an error, Then it keeps only origin and path', () => {
    expect(sanitizeGitHubAttachmentUrlForError(
      'https://private-user-images.githubusercontent.com/123/456.png?token=secret#fragment',
    )).toBe('https://private-user-images.githubusercontent.com/123/456.png');
  });
});
