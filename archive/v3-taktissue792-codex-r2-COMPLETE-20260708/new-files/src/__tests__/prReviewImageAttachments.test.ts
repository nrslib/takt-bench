import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { preparePrReviewImageAttachments } from '../features/tasks/prReviewImageAttachments.js';
import type { PrReviewData } from '../infra/git/index.js';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const GIF_BYTES = Buffer.from('GIF89a');
const WEBP_BYTES = Buffer.from([...Buffer.from('RIFF'), 0x00, 0x00, 0x00, 0x00, ...Buffer.from('WEBP')]);

const tempRoots = new Set<string>();

afterEach(() => {
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.clear();
});

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'takt-pr-attachments-test-'));
  tempRoots.add(root);
  return root;
}

function createPrReview(overrides: Partial<PrReviewData> = {}): PrReviewData {
  return {
    number: 456,
    title: 'Fix auth bug',
    body: 'PR body',
    url: 'https://github.com/org/repo/pull/456',
    headRefName: 'feature/fix-auth',
    baseRefName: 'main',
    comments: [],
    reviews: [],
    files: ['src/auth.ts'],
    ...overrides,
  };
}

describe('preparePrReviewImageAttachments', () => {
  it('downloads GitHub images from PR body, comments, review summaries, and review threads, then replaces references with placeholders', async () => {
    const cwd = createTempRoot();
    const pngUrl = 'https://github.com/user-attachments/assets/png-asset';
    const jpgUrl = 'https://github.com/org/repo/assets/jpg-asset';
    const gifUrl = 'https://github.com/user-attachments/assets/gif-asset';
    const webpUrl = 'https://github.com/user-attachments/assets/webp-asset';
    const externalUrl = 'https://example.com/untrusted.png';
    const prReview = createPrReview({
      body: `Body ![body screenshot](${pngUrl}) and ![external](${externalUrl})`,
      comments: [
        { author: 'commenter', body: `Comment <img alt="comment" src="${jpgUrl}" />` },
        { author: 'second-commenter', body: `Duplicate ![again](${pngUrl})` },
      ],
      reviews: [
        { author: 'reviewer', body: `Summary <img src='${gifUrl}'>` },
        {
          author: 'thread-reviewer',
          body: `Thread <img src=${webpUrl} />`,
          path: 'src/auth.ts',
          line: 12,
          url: 'https://github.com/org/repo/pull/456#discussion_r1',
          threadState: 'active',
        },
      ],
    });
    const downloadImage = vi.fn(async (url: string) => {
      const responses = new Map([
        [pngUrl, { body: PNG_BYTES, contentType: 'image/png', finalUrl: pngUrl }],
        [jpgUrl, { body: JPEG_BYTES, contentType: 'image/jpeg', finalUrl: jpgUrl }],
        [gifUrl, { body: GIF_BYTES, contentType: 'image/gif', finalUrl: gifUrl }],
        [webpUrl, { body: WEBP_BYTES, contentType: 'image/webp', finalUrl: webpUrl }],
      ]);
      const response = responses.get(url);
      if (!response) {
        throw new Error(`Unexpected download: ${url}`);
      }
      return response;
    });

    const result = await preparePrReviewImageAttachments(prReview, {
      cwd,
      downloadImage,
      maxBytes: 1024,
    });

    expect(downloadImage).toHaveBeenCalledTimes(4);
    expect(downloadImage).toHaveBeenNthCalledWith(1, pngUrl, expect.objectContaining({ cwd, maxBytes: 1024 }));
    expect(downloadImage).not.toHaveBeenCalledWith(externalUrl, expect.anything());
    expect(result.prReview).not.toBe(prReview);
    expect(result.prReview.body).toContain('Body [Image #1]');
    expect(result.prReview.body).toContain(`![external](${externalUrl})`);
    expect(result.prReview.comments[0]?.body).toBe('Comment [Image #2]');
    expect(result.prReview.comments[1]?.body).toBe('Duplicate [Image #1]');
    expect(result.prReview.reviews[0]?.body).toBe('Summary [Image #3]');
    expect(result.prReview.reviews[1]?.body).toBe('Thread [Image #4]');
    expect(prReview.body).toContain(pngUrl);
    expect(result.attachments.map((attachment) => ({
      placeholder: attachment.placeholder,
      fileName: attachment.fileName,
      bytes: fs.readFileSync(attachment.tempPath),
    }))).toEqual([
      { placeholder: '[Image #1]', fileName: 'image-1.png', bytes: PNG_BYTES },
      { placeholder: '[Image #2]', fileName: 'image-2.jpg', bytes: JPEG_BYTES },
      { placeholder: '[Image #3]', fileName: 'image-3.gif', bytes: GIF_BYTES },
      { placeholder: '[Image #4]', fileName: 'image-4.webp', bytes: WEBP_BYTES },
    ]);

    result.cleanup();
    expect(fs.existsSync(result.attachments[0]!.tempPath)).toBe(false);
  });

  it('rejects a response whose Content-Type does not match the magic bytes', async () => {
    const cwd = createTempRoot();
    const imageUrl = 'https://github.com/user-attachments/assets/mismatch';
    const prReview = createPrReview({ body: `![bad](${imageUrl})` });

    await expect(preparePrReviewImageAttachments(prReview, {
      cwd,
      maxBytes: 1024,
      downloadImage: vi.fn(async () => ({
        body: JPEG_BYTES,
        contentType: 'image/png',
        finalUrl: imageUrl,
      })),
    })).rejects.toThrow('Content-Type image/png does not match image data image/jpeg');
  });

  it('rejects unsupported image data even when the URL is allowed', async () => {
    const cwd = createTempRoot();
    const imageUrl = 'https://github.com/user-attachments/assets/svg';
    const prReview = createPrReview({ body: `<img src="${imageUrl}" />` });

    await expect(preparePrReviewImageAttachments(prReview, {
      cwd,
      maxBytes: 1024,
      downloadImage: vi.fn(async () => ({
        body: Buffer.from('<svg></svg>'),
        contentType: 'image/svg+xml',
        finalUrl: imageUrl,
      })),
    })).rejects.toThrow('Unsupported PR image type. Expected PNG, JPEG, GIF, or WebP data.');
  });

  it('rejects images larger than the configured byte limit', async () => {
    const cwd = createTempRoot();
    const imageUrl = 'https://github.com/user-attachments/assets/too-large';
    const prReview = createPrReview({ body: `![large](${imageUrl})` });

    await expect(preparePrReviewImageAttachments(prReview, {
      cwd,
      maxBytes: PNG_BYTES.length - 1,
      downloadImage: vi.fn(async () => ({
        body: PNG_BYTES,
        contentType: 'image/png',
        finalUrl: imageUrl,
      })),
    })).rejects.toThrow(`PR image exceeds the ${PNG_BYTES.length - 1} byte limit`);
  });

  it('does not expose signed private image URL query values in validation errors', async () => {
    const cwd = createTempRoot();
    const imageUrl = 'https://private-user-images.githubusercontent.com/image.png?token=secret-token#fragment';
    const prReview = createPrReview({ body: `![large](${imageUrl})` });

    let caught: unknown;
    try {
      await preparePrReviewImageAttachments(prReview, {
        cwd,
        maxBytes: PNG_BYTES.length - 1,
        downloadImage: vi.fn(async () => ({
          body: PNG_BYTES,
          contentType: 'image/png',
          finalUrl: imageUrl,
        })),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toContain('https://private-user-images.githubusercontent.com/image.png');
    expect(message).not.toContain('secret-token');
    expect(message).not.toContain('#fragment');
  });

  it('rejects redirects that leave the GitHub attachment allowlist', async () => {
    const cwd = createTempRoot();
    const imageUrl = 'https://github.com/user-attachments/assets/redirect';
    const prReview = createPrReview({ body: `![redirect](${imageUrl})` });

    await expect(preparePrReviewImageAttachments(prReview, {
      cwd,
      maxBytes: 1024,
      downloadImage: vi.fn(async () => ({
        body: PNG_BYTES,
        contentType: 'image/png',
        finalUrl: 'https://example.com/redirected.png',
      })),
    })).rejects.toThrow('PR image redirect URL is not an allowed GitHub attachment URL');
  });
});
