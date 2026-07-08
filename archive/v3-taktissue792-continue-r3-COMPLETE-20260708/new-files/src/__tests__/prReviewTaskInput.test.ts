import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrReviewData } from '../infra/git/types.js';
import type { TaskAttachment } from '../features/tasks/attachments.js';
import { MAX_IMAGE_ATTACHMENT_BYTES } from '../shared/utils/imageTypes.js';
import { resolvePrReviewTaskInput } from '../features/tasks/prReviewTaskInput.js';

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(() => 'test-gh-token\n'),
}));

vi.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const GIF_BYTES = Buffer.from('GIF89a');
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
]);

const GITHUB_IMAGE_URL = 'https://github.com/user-attachments/assets/screenshot-1';

const mockFetch = vi.fn();

function createPrReview(overrides: Partial<PrReviewData> = {}): PrReviewData {
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

function createBodyStream(data: Buffer, onPull?: () => void): ReadableStream<Uint8Array> {
  let sent = false;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      onPull?.();
      if (sent) {
        controller.close();
        return;
      }
      sent = true;
      controller.enqueue(new Uint8Array(data));
    },
  });
}

function queueImageResponse(contentType: string, data: Buffer, contentLength?: string): ReturnType<typeof vi.fn> {
  const arrayBuffer = vi.fn();
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-type') {
          return contentType;
        }
        if (name.toLowerCase() === 'content-length') {
          return contentLength ?? String(data.byteLength);
        }
        return null;
      },
    },
    body: createBodyStream(data),
    arrayBuffer,
  });
  return arrayBuffer;
}

function queueStreamImageResponse(
  contentType: string,
  body: ReadableStream<Uint8Array>,
  contentLength: string | null,
): ReturnType<typeof vi.fn> {
  const arrayBuffer = vi.fn();
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-type') {
          return contentType;
        }
        if (name.toLowerCase() === 'content-length') {
          return contentLength;
        }
        return null;
      },
    },
    body,
    arrayBuffer,
  });
  return arrayBuffer;
}

function requireAttachments(attachments: readonly TaskAttachment[] | undefined, count: number): readonly TaskAttachment[] {
  expect(attachments).toBeDefined();
  expect(attachments).toHaveLength(count);
  return attachments!;
}

function expectAttachmentFile(attachment: TaskAttachment, expected: Buffer): void {
  expect(fs.readFileSync(attachment.tempPath)).toEqual(expected);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

describe('resolvePrReviewTaskInput', () => {
  it('Given Markdown image syntax in the PR body, When resolving task input, Then the image is downloaded and referenced by placeholder plus temp path', async () => {
    queueImageResponse('image/png', PNG_BYTES);
    const prReview = createPrReview({
      body: `Please inspect ![screenshot](${GITHUB_IMAGE_URL}) before merging.`,
    });

    const result = await resolvePrReviewTaskInput('/repo', prReview);
    const [attachment] = requireAttachments(result.attachments, 1);

    expect(attachment).toEqual(expect.objectContaining({
      placeholder: '[Image #1]',
      fileName: 'image-1.png',
    }));
    expectAttachmentFile(attachment!, PNG_BYTES);
    expect(result.task).toContain(`Please inspect [Image #1] (\`${attachment!.tempPath}\`) before merging.`);
    expect(result.task).not.toContain(`![screenshot](${GITHUB_IMAGE_URL})`);
    expect(mockExecFileSync).toHaveBeenCalledWith('gh', ['auth', 'token'], expect.objectContaining({ cwd: '/repo' }));
    expect(mockFetch).toHaveBeenCalledWith(
      GITHUB_IMAGE_URL,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-gh-token',
          'User-Agent': 'takt',
        }),
      }),
    );
    result.cleanupAttachments?.();
  });

  it('Given HTML img syntax in a PR comment, When resolving task input, Then quoted src URLs are replaced with image placeholders', async () => {
    const imageUrl = 'https://private-user-images.githubusercontent.com/123/image.png';
    queueImageResponse('image/jpeg; charset=binary', JPEG_BYTES);
    const prReview = createPrReview({
      comments: [{ author: 'reviewer', body: `<img alt="capture" src="${imageUrl}" />` }],
    });

    const result = await resolvePrReviewTaskInput('/repo', prReview);
    const [attachment] = requireAttachments(result.attachments, 1);

    expect(attachment).toEqual(expect.objectContaining({
      placeholder: '[Image #1]',
      fileName: 'image-1.jpg',
    }));
    expect(result.task).toContain(`**reviewer**: [Image #1] (\`${attachment!.tempPath}\`)`);
    expect(result.task).not.toContain('<img');
    result.cleanupAttachments?.();
  });

  it('Given images across PR body, conversation comments, review summaries, and review threads, When resolving task input, Then every PR text source is scanned', async () => {
    const bodyUrl = 'https://github.com/user-attachments/assets/body';
    const commentUrl = 'https://github.com/org/repo/assets/comment';
    const summaryUrl = 'https://user-images.githubusercontent.com/1/summary.gif';
    const threadUrl = 'https://private-user-images.githubusercontent.com/2/thread.webp';
    queueImageResponse('image/png', PNG_BYTES);
    queueImageResponse('image/jpeg', JPEG_BYTES);
    queueImageResponse('image/gif', GIF_BYTES);
    queueImageResponse('image/webp', WEBP_BYTES);

    const result = await resolvePrReviewTaskInput('/repo', createPrReview({
      body: `Body ![body](${bodyUrl})`,
      comments: [{ author: 'commenter', body: `Comment ![comment](${commentUrl})` }],
      reviews: [
        { author: 'summary-reviewer', body: `Summary ![summary](${summaryUrl})` },
        { author: 'thread-reviewer', path: 'src/auth.ts', line: 12, threadState: 'active', body: `Thread <img src='${threadUrl}' />` },
      ],
    }));
    const attachments = requireAttachments(result.attachments, 4);

    expect(attachments.map((attachment) => attachment.fileName)).toEqual([
      'image-1.png',
      'image-2.jpg',
      'image-3.gif',
      'image-4.webp',
    ]);
    for (const attachment of attachments) {
      expect(result.task).toContain(`${attachment.placeholder} (\`${attachment.tempPath}\`)`);
    }
    expect(result.task).toContain('### Conversation Comments');
    expect(result.task).toContain('### Review Summaries');
    expect(result.task).toContain('### Active Review Threads');
    expect(mockFetch).toHaveBeenCalledTimes(4);
    result.cleanupAttachments?.();
  });

  it('Given the same GitHub image URL appears multiple times, When resolving task input, Then it is downloaded once and the same placeholder is reused', async () => {
    queueImageResponse('image/png', PNG_BYTES);
    const prReview = createPrReview({
      body: `First ![first](${GITHUB_IMAGE_URL})`,
      comments: [{ author: 'reviewer', body: `Again ![again](${GITHUB_IMAGE_URL})` }],
    });

    const result = await resolvePrReviewTaskInput('/repo', prReview);
    const [attachment] = requireAttachments(result.attachments, 1);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.task.match(/\[Image #1\]/g)).toHaveLength(2);
    expect(result.task).toContain(`First [Image #1] (\`${attachment!.tempPath}\`)`);
    expect(result.task).toContain(`Again [Image #1] (\`${attachment!.tempPath}\`)`);
    result.cleanupAttachments?.();
  });

  it('Given an external image URL, When resolving task input, Then no network request is made and the original Markdown remains visible', async () => {
    const externalUrl = 'https://example.com/image.png';
    const prReview = createPrReview({
      body: `External ![external](${externalUrl})`,
    });

    const result = await resolvePrReviewTaskInput('/repo', prReview);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.task).toContain(`External ![external](${externalUrl})`);
    expect(result.task).not.toContain('[Image #1]');
    expect(result.attachments).toBeUndefined();
  });

  it('Given a GitHub image URL with an unsupported Content-Type, When resolving task input, Then the task fails before partial attachments are returned', async () => {
    queueImageResponse('text/plain', PNG_BYTES);
    const prReview = createPrReview({
      body: `Invalid ![invalid](${GITHUB_IMAGE_URL})`,
    });

    await expect(resolvePrReviewTaskInput('/repo', prReview)).rejects.toThrow(/Content-Type/);
  });

  it('Given a GitHub image URL whose Content-Type and magic bytes disagree, When resolving task input, Then the task fails fast', async () => {
    queueImageResponse('image/png', JPEG_BYTES);
    const prReview = createPrReview({
      body: `Invalid ![invalid](${GITHUB_IMAGE_URL})`,
    });

    await expect(resolvePrReviewTaskInput('/repo', prReview)).rejects.toThrow(/magic bytes|image data|mismatch/i);
  });

  it('Given a GitHub image URL larger than the size limit, When resolving task input, Then the download is rejected', async () => {
    const oversized = Buffer.alloc(MAX_IMAGE_ATTACHMENT_BYTES + 1);
    PNG_BYTES.copy(oversized, 0);
    const arrayBuffer = queueImageResponse('image/png', oversized);
    const prReview = createPrReview({
      body: `Large ![large](${GITHUB_IMAGE_URL})`,
    });

    await expect(resolvePrReviewTaskInput('/repo', prReview)).rejects.toThrow(`${MAX_IMAGE_ATTACHMENT_BYTES}`);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('Given Content-Length exceeds the size limit, When resolving task input, Then the response body is not read', async () => {
    let getReaderCalled = false;
    const body = {
      getReader() {
        getReaderCalled = true;
        throw new Error('body should not be read');
      },
    } as unknown as ReadableStream<Uint8Array>;
    const arrayBuffer = queueStreamImageResponse('image/png', body, String(MAX_IMAGE_ATTACHMENT_BYTES + 1));
    const prReview = createPrReview({
      body: `Large ![large](${GITHUB_IMAGE_URL})`,
    });

    await expect(resolvePrReviewTaskInput('/repo', prReview)).rejects.toThrow(`${MAX_IMAGE_ATTACHMENT_BYTES}`);
    expect(getReaderCalled).toBe(false);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('Given Content-Length is absent and streamed bytes exceed the limit, When resolving task input, Then the download stops at the streaming boundary', async () => {
    let chunkIndex = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunkIndex += 1;
        if (chunkIndex === 1) {
          controller.enqueue(new Uint8Array(PNG_BYTES));
          return;
        }
        controller.enqueue(new Uint8Array(Buffer.alloc(MAX_IMAGE_ATTACHMENT_BYTES + 1)));
      },
    });
    const arrayBuffer = queueStreamImageResponse('image/png', body, null);
    const prReview = createPrReview({
      body: `Large ![large](${GITHUB_IMAGE_URL})`,
    });

    await expect(resolvePrReviewTaskInput('/repo', prReview)).rejects.toThrow(`${MAX_IMAGE_ATTACHMENT_BYTES}`);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('Given downloaded PR attachments, When cleanup is invoked, Then temporary image files are removed', async () => {
    queueImageResponse('image/png', PNG_BYTES);
    const result = await resolvePrReviewTaskInput('/repo', createPrReview({
      body: `Cleanup ![cleanup](${GITHUB_IMAGE_URL})`,
    }));
    const [attachment] = requireAttachments(result.attachments, 1);
    const sessionDir = path.dirname(path.dirname(attachment!.tempPath));

    expect(fs.existsSync(attachment!.tempPath)).toBe(true);
    expect(result.cleanupAttachments).toEqual(expect.any(Function));

    result.cleanupAttachments?.();

    expect(fs.existsSync(sessionDir)).toBe(false);
  });
});
