import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePrReviewImageAttachments } from '../features/tasks/prReviewImageAttachments.js';
import type { PrReviewData } from '../infra/git/index.js';

type DownloadResult = {
  body: Buffer;
  contentType: string;
  finalUrl?: string;
};

type DownloadOptions = {
  cwd: string;
  maxBytes: number;
};

type Downloader = (url: string, options: DownloadOptions) => Promise<DownloadResult>;

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF_BYTES = Buffer.from('GIF89a');
const WEBP_BYTES = Buffer.from([
  0x52, 0x49, 0x46, 0x46,
  0x08, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x20,
]);

const tempRoots = new Set<string>();

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.clear();
});

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'takt-pr-review-images-test-'));
  tempRoots.add(root);
  return root;
}

function createPrReview(overrides: Partial<PrReviewData> = {}): PrReviewData {
  return {
    number: 456,
    title: 'Fix auth bug',
    body: 'PR description',
    url: 'https://github.com/org/repo/pull/456',
    headRefName: 'feature/fix-auth-bug',
    baseRefName: 'main',
    comments: [{ author: 'commenter', body: 'Conversation comment' }],
    reviews: [{ author: 'reviewer', body: 'Review summary' }],
    files: ['src/auth.ts'],
    ...overrides,
  };
}

function createDownloader(results: Record<string, DownloadResult>): Downloader {
  return vi.fn(async (url: string, _options: DownloadOptions) => {
    const result = results[url];
    if (!result) {
      throw new Error(`Unexpected download: ${url}`);
    }
    return result;
  });
}

describe('resolvePrReviewImageAttachments', () => {
  it('should download GitHub images from PR body, conversation comments, review summaries, and review thread comments', async () => {
    const tmpRoot = createTempRoot();
    const bodyUrl = 'https://github.com/user-attachments/assets/body-png';
    const commentUrl = 'https://github.com/org/repo/assets/comment-jpg';
    const summaryUrl = 'https://private-user-images.githubusercontent.com/123/review-gif';
    const threadUrl = 'https://github.com/user-attachments/assets/thread-webp';
    const downloader = createDownloader({
      [bodyUrl]: { body: PNG_BYTES, contentType: 'image/png; charset=binary' },
      [commentUrl]: { body: JPEG_BYTES, contentType: 'image/jpeg' },
      [summaryUrl]: { body: GIF_BYTES, contentType: 'image/gif' },
      [threadUrl]: { body: WEBP_BYTES, contentType: 'image/webp' },
    });

    const result = await resolvePrReviewImageAttachments(createPrReview({
      body: `Body screenshot ![body](${bodyUrl})`,
      comments: [{ author: 'commenter', body: `Conversation image <img src="${commentUrl}" />` }],
      reviews: [
        { author: 'summary', body: `Summary image ![summary](${summaryUrl})` },
        {
          author: 'threader',
          body: `Thread image <img alt="thread" src='${threadUrl}'>`,
          path: 'src/auth.ts',
          line: 10,
          url: 'https://github.com/org/repo/pull/456#discussion_r1',
          threadState: 'active',
        },
      ],
    }), {
      cwd: tmpRoot,
      tmpRoot,
      downloader,
      maxBytes: 1024,
    });

    expect(result.prReview.body).toBe('Body screenshot [Image #1]');
    expect(result.prReview.comments[0]?.body).toBe('Conversation image [Image #2]');
    expect(result.prReview.reviews[0]?.body).toBe('Summary image [Image #3]');
    expect(result.prReview.reviews[1]?.body).toBe('Thread image [Image #4]');
    expect(result.attachments.map((attachment) => ({
      placeholder: attachment.placeholder,
      fileName: attachment.fileName,
    }))).toEqual([
      { placeholder: '[Image #1]', fileName: 'image-1.png' },
      { placeholder: '[Image #2]', fileName: 'image-2.jpg' },
      { placeholder: '[Image #3]', fileName: 'image-3.gif' },
      { placeholder: '[Image #4]', fileName: 'image-4.webp' },
    ]);
    expect(fs.readFileSync(result.attachments[0]!.tempPath)).toEqual(PNG_BYTES);
    expect(fs.readFileSync(result.attachments[1]!.tempPath)).toEqual(JPEG_BYTES);
    expect(fs.readFileSync(result.attachments[2]!.tempPath)).toEqual(GIF_BYTES);
    expect(fs.readFileSync(result.attachments[3]!.tempPath)).toEqual(WEBP_BYTES);
    expect(result.failures).toEqual([]);
    expect(downloader).toHaveBeenCalledTimes(4);
    expect(downloader).toHaveBeenNthCalledWith(1, bodyUrl, expect.objectContaining({
      cwd: tmpRoot,
      maxBytes: 1024,
    }));
  });

  it('should download duplicate image URLs once and reuse the same placeholder', async () => {
    const tmpRoot = createTempRoot();
    const imageUrl = 'https://github.com/user-attachments/assets/same-image';
    const downloader = createDownloader({
      [imageUrl]: { body: PNG_BYTES, contentType: 'image/png' },
    });

    const result = await resolvePrReviewImageAttachments(createPrReview({
      body: `Body ![first](${imageUrl})`,
      comments: [{ author: 'commenter', body: `Comment ![second](${imageUrl})` }],
    }), {
      cwd: tmpRoot,
      tmpRoot,
      downloader,
      maxBytes: 1024,
    });

    expect(result.prReview.body).toBe('Body [Image #1]');
    expect(result.prReview.comments[0]?.body).toBe('Comment [Image #1]');
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]?.fileName).toBe('image-1.png');
    expect(result.failures).toEqual([]);
    expect(downloader).toHaveBeenCalledTimes(1);
  });

  it('should leave non-GitHub image URLs untouched and not fetch them', async () => {
    const tmpRoot = createTempRoot();
    const externalUrl = 'https://example.com/screenshot.png';
    const downloader = createDownloader({});

    const result = await resolvePrReviewImageAttachments(createPrReview({
      body: `External image ![external](${externalUrl})`,
    }), {
      cwd: tmpRoot,
      tmpRoot,
      downloader,
      maxBytes: 1024,
    });

    expect(result.prReview.body).toBe(`External image ![external](${externalUrl})`);
    expect(result.attachments).toEqual([]);
    expect(result.failures).toEqual([]);
    expect(downloader).not.toHaveBeenCalled();
  });

  it('should leave a GitHub image reference untouched when Content-Type is not an allowed image type', async () => {
    const tmpRoot = createTempRoot();
    const imageUrl = 'https://github.com/user-attachments/assets/not-image';
    const downloader = createDownloader({
      [imageUrl]: { body: PNG_BYTES, contentType: 'text/plain' },
    });

    const result = await resolvePrReviewImageAttachments(createPrReview({
      body: `Bad image ![bad](${imageUrl})`,
    }), {
      cwd: tmpRoot,
      tmpRoot,
      downloader,
      maxBytes: 1024,
    });

    expect(result.prReview.body).toContain(`Bad image ![bad](${imageUrl})`);
    expect(result.prReview.body).toContain('### PR Image Attachment Warnings');
    expect(result.prReview.body).toContain('Unsupported image content-type: text/plain');
    expect(result.attachments).toEqual([]);
    expect(result.failures).toEqual([{
      url: imageUrl,
      phase: 'validation',
      reason: 'Unsupported image content-type: text/plain',
    }]);
  });

  it('should leave a GitHub image reference untouched when magic bytes do not match Content-Type', async () => {
    const tmpRoot = createTempRoot();
    const imageUrl = 'https://github.com/user-attachments/assets/mismatch';
    const downloader = createDownloader({
      [imageUrl]: { body: JPEG_BYTES, contentType: 'image/png' },
    });

    const result = await resolvePrReviewImageAttachments(createPrReview({
      body: `Bad image ![bad](${imageUrl})`,
    }), {
      cwd: tmpRoot,
      tmpRoot,
      downloader,
      maxBytes: 1024,
    });

    expect(result.prReview.body).toContain(`Bad image ![bad](${imageUrl})`);
    expect(result.prReview.body).toContain('### PR Image Attachment Warnings');
    expect(result.prReview.body).toContain('magic bytes do not match content-type');
    expect(result.attachments).toEqual([]);
    expect(result.failures).toEqual([{
      url: imageUrl,
      phase: 'validation',
      reason: 'PR image attachment magic bytes do not match content-type: image/jpeg !== image/png',
    }]);
  });

  it('should leave a GitHub image reference untouched when it exceeds the configured size limit', async () => {
    const tmpRoot = createTempRoot();
    const imageUrl = 'https://github.com/user-attachments/assets/too-large';
    const downloader = createDownloader({
      [imageUrl]: { body: Buffer.concat([PNG_BYTES, Buffer.alloc(32)]), contentType: 'image/png' },
    });

    const result = await resolvePrReviewImageAttachments(createPrReview({
      body: `Large image ![large](${imageUrl})`,
    }), {
      cwd: tmpRoot,
      tmpRoot,
      downloader,
      maxBytes: PNG_BYTES.length,
    });

    expect(result.prReview.body).toContain(`Large image ![large](${imageUrl})`);
    expect(result.prReview.body).toContain('### PR Image Attachment Warnings');
    expect(result.prReview.body).toContain(`PR image attachment exceeds the ${PNG_BYTES.length} byte limit`);
    expect(result.attachments).toEqual([]);
    expect(result.failures).toEqual([{
      url: imageUrl,
      phase: 'validation',
      reason: `PR image attachment exceeds the ${PNG_BYTES.length} byte limit: ${imageUrl}`,
    }]);
  });

  it('should keep valid images when another image download fails', async () => {
    const tmpRoot = createTempRoot();
    const failedUrl = 'https://github.com/user-attachments/assets/missing-image';
    const validUrl = 'https://github.com/user-attachments/assets/valid-image';
    const downloader = vi.fn(async (url: string) => {
      if (url === failedUrl) {
        throw new Error('HTTP 404');
      }
      return { body: PNG_BYTES, contentType: 'image/png' };
    });

    const result = await resolvePrReviewImageAttachments(createPrReview({
      body: `Missing ![missing](${failedUrl}) Valid ![valid](${validUrl})`,
    }), {
      cwd: tmpRoot,
      tmpRoot,
      downloader,
      maxBytes: 1024,
    });

    expect(result.prReview.body).toContain(`Missing ![missing](${failedUrl}) Valid [Image #1]`);
    expect(result.prReview.body).toContain('### PR Image Attachment Warnings');
    expect(result.prReview.body).toContain('HTTP 404');
    expect(result.attachments.map((attachment) => attachment.fileName)).toEqual(['image-1.png']);
    expect(result.failures).toEqual([{
      url: failedUrl,
      phase: 'download',
      reason: 'HTTP 404',
    }]);
    expect(downloader).toHaveBeenCalledTimes(2);
  });

  it('should redact sensitive values from image attachment failure reasons and warnings', async () => {
    const tmpRoot = createTempRoot();
    const failedUrl = 'https://github.com/user-attachments/assets/private-image?api_key=url-secret';
    const redactedUrl = 'https://github.com/user-attachments/assets/private-image';
    const downloader = vi.fn(async () => {
      throw new Error(
        'api_key=body-secret https://github.com/user-attachments/assets/private-image?token=query-secret Authorization: Bearer header-secret',
      );
    });

    const result = await resolvePrReviewImageAttachments(createPrReview({
      body: `Private ![private](${failedUrl})`,
    }), {
      cwd: tmpRoot,
      tmpRoot,
      downloader,
      maxBytes: 1024,
    });

    expect(result.failures).toEqual([{
      url: redactedUrl,
      phase: 'download',
      reason: `api_key=[REDACTED] ${redactedUrl} Authorization: Bearer [REDACTED]`,
    }]);
    expect(result.prReview.body).toContain('Authorization: Bearer [REDACTED]');
    expect(result.prReview.body).toContain('api_key=[REDACTED]');
    expect(result.prReview.body).not.toContain('header-secret');
    expect(result.prReview.body).not.toContain('body-secret');
    expect(result.prReview.body).not.toContain('query-secret');
  });

  it('should enforce the maximum image count before downloading', async () => {
    const tmpRoot = createTempRoot();
    const firstUrl = 'https://github.com/user-attachments/assets/first';
    const secondUrl = 'https://github.com/user-attachments/assets/second';
    const thirdUrl = 'https://github.com/user-attachments/assets/third';
    const downloader = createDownloader({
      [firstUrl]: { body: PNG_BYTES, contentType: 'image/png' },
      [secondUrl]: { body: JPEG_BYTES, contentType: 'image/jpeg' },
      [thirdUrl]: { body: GIF_BYTES, contentType: 'image/gif' },
    });

    const result = await resolvePrReviewImageAttachments(createPrReview({
      body: `One ![one](${firstUrl}) Two ![two](${secondUrl}) Three ![three](${thirdUrl})`,
    }), {
      cwd: tmpRoot,
      tmpRoot,
      downloader,
      maxBytes: 1024,
      maxImages: 2,
    });

    expect(result.prReview.body).toContain(`One [Image #1] Two [Image #2] Three ![three](${thirdUrl})`);
    expect(result.prReview.body).toContain('### PR Image Attachment Warnings');
    expect(result.prReview.body).toContain(
      `- ${thirdUrl}: PR image attachment count limit exceeded: only the first 2 images are downloaded.`,
    );
    expect(result.attachments.map((attachment) => attachment.fileName)).toEqual(['image-1.png', 'image-2.jpg']);
    expect(result.failures).toEqual([{
      url: thirdUrl,
      phase: 'image_count',
      reason: 'PR image attachment count limit exceeded: only the first 2 images are downloaded.',
    }]);
    expect(downloader).toHaveBeenCalledTimes(2);
    expect(downloader).not.toHaveBeenCalledWith(thirdUrl, expect.anything());
  });

  it('should leave images beyond the total byte limit untouched', async () => {
    const tmpRoot = createTempRoot();
    const firstUrl = 'https://github.com/user-attachments/assets/first';
    const secondUrl = 'https://github.com/user-attachments/assets/second';
    const downloader = createDownloader({
      [firstUrl]: { body: PNG_BYTES, contentType: 'image/png' },
      [secondUrl]: { body: JPEG_BYTES, contentType: 'image/jpeg' },
    });

    const result = await resolvePrReviewImageAttachments(createPrReview({
      body: `One ![one](${firstUrl}) Two ![two](${secondUrl})`,
    }), {
      cwd: tmpRoot,
      tmpRoot,
      downloader,
      maxBytes: 1024,
      maxTotalBytes: PNG_BYTES.length,
    });

    expect(result.prReview.body).toContain(`One [Image #1] Two ![two](${secondUrl})`);
    expect(result.prReview.body).toContain('### PR Image Attachment Warnings');
    expect(result.prReview.body).toContain(`PR image attachment total byte limit would exceed ${PNG_BYTES.length} bytes.`);
    expect(result.attachments.map((attachment) => attachment.fileName)).toEqual(['image-1.png']);
    expect(result.failures).toEqual([{
      url: secondUrl,
      phase: 'total_size',
      reason: `PR image attachment total byte limit would exceed ${PNG_BYTES.length} bytes.`,
    }]);
    expect(downloader).toHaveBeenCalledTimes(2);
  });

  it('should reject and cleanup when saving a downloaded image fails', async () => {
    const parentRoot = createTempRoot();
    const tmpRoot = path.join(parentRoot, 'not-a-directory');
    fs.writeFileSync(tmpRoot, 'file root');
    const imageUrl = 'https://github.com/user-attachments/assets/save-fails';
    const downloader = createDownloader({
      [imageUrl]: { body: PNG_BYTES, contentType: 'image/png' },
    });

    await expect(resolvePrReviewImageAttachments(createPrReview({
      body: `Save image ![save](${imageUrl})`,
    }), {
      cwd: tmpRoot,
      tmpRoot,
      downloader,
      maxBytes: 1024,
    })).rejects.toThrow(`Failed to save PR image attachment ${imageUrl}: ENOTDIR`);

    expect(fs.existsSync(path.join(tmpRoot, 'takt'))).toBe(false);
  });
});
