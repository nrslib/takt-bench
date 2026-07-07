import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrReviewData } from '../infra/git/index.js';
import { resolvePrReviewImageAttachments } from '../features/tasks/prReviewImageAttachments.js';

interface DownloadedImage {
  body: Buffer;
  contentType: string;
  contentLength?: number;
}

interface DownloadRequestOptions {
  headers: Record<string, string>;
  maxBytes: number;
}

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
]);
const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const gifBytes = Buffer.from('GIF89a', 'ascii');
const webpBytes = Buffer.from('RIFF\x0c\x00\x00\x00WEBPVP8 ', 'binary');

let testDir: string;

function createPrReview(overrides: Partial<PrReviewData> = {}): PrReviewData {
  return {
    number: 42,
    title: 'Review images',
    body: 'PR body',
    url: 'https://github.com/org/repo/pull/42',
    headRefName: 'feature/review-images',
    baseRefName: 'main',
    comments: [],
    reviews: [],
    files: ['src/app.ts'],
    ...overrides,
  };
}

function createDownloader(images: Record<string, DownloadedImage>) {
  return vi.fn(async (url: string, _options: DownloadRequestOptions) => {
    const image = images[url];
    if (!image) {
      throw new Error(`unexpected download: ${url}`);
    }
    return image;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  testDir = fs.mkdtempSync(path.join(tmpdir(), 'takt-pr-images-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('resolvePrReviewImageAttachments', () => {
  it('PR本文・通常コメント・review summary・review threadのGitHub画像を抽出し、本文を同じplaceholderへ置換する', async () => {
    const markdownUrl = 'https://github.com/user-attachments/assets/markdown-png';
    const duplicateUrl = 'https://github.com/org/repo/assets/duplicate-jpeg';
    const htmlUrl = 'https://github.com/user-attachments/assets/html-gif';
    const threadUrl = 'https://github.com/org/repo/assets/thread-webp';
    const downloadImage = createDownloader({
      [markdownUrl]: { body: pngBytes, contentType: 'image/png', contentLength: pngBytes.length },
      [duplicateUrl]: { body: jpegBytes, contentType: 'image/jpeg', contentLength: jpegBytes.length },
      [htmlUrl]: { body: gifBytes, contentType: 'image/gif', contentLength: gifBytes.length },
      [threadUrl]: { body: webpBytes, contentType: 'image/webp', contentLength: webpBytes.length },
    });
    const prReview = createPrReview({
      body: `Body screenshot ![screenshot](${markdownUrl})`,
      comments: [
        { author: 'commenter', body: `First duplicate ![image](${duplicateUrl})` },
        { author: 'commenter', body: `Same duplicate again <img src="${duplicateUrl}" />` },
      ],
      reviews: [
        { author: 'reviewer', body: `Review summary <img src="${htmlUrl}" />` },
        {
          author: 'thread-reviewer',
          body: `Thread image ![thread](${threadUrl})`,
          path: 'src/app.ts',
          line: 12,
          threadState: 'active',
        },
      ],
    });

    const result = await resolvePrReviewImageAttachments(prReview, {
      cwd: testDir,
      getGithubToken: () => 'gh-token',
      downloadImage,
    });

    expect(downloadImage).toHaveBeenCalledTimes(4);
    const firstDownloadOptions = downloadImage.mock.calls[0]?.[1];
    expect(firstDownloadOptions).toBeDefined();
    if (!firstDownloadOptions) {
      throw new Error('download options were not captured');
    }
    expect(Object.values(firstDownloadOptions.headers).join('\n')).toContain('gh-token');
    expect(firstDownloadOptions.maxBytes).toBe(10 * 1024 * 1024);

    expect(result.attachments).toEqual([
      expect.objectContaining({ placeholder: '[Image #1]', fileName: 'image-1.png' }),
      expect.objectContaining({ placeholder: '[Image #2]', fileName: 'image-2.jpg' }),
      expect.objectContaining({ placeholder: '[Image #3]', fileName: 'image-3.gif' }),
      expect.objectContaining({ placeholder: '[Image #4]', fileName: 'image-4.webp' }),
    ]);
    expect(result.prReview.body).toContain('Body screenshot [Image #1]');
    expect(result.prReview.comments[0]?.body).toContain('First duplicate [Image #2]');
    expect(result.prReview.comments[1]?.body).toContain('Same duplicate again [Image #2]');
    expect(result.prReview.reviews[0]?.body).toContain('Review summary [Image #3]');
    expect(result.prReview.reviews[1]?.body).toContain('Thread image [Image #4]');
    expect(fs.readFileSync(result.attachments[0]!.tempPath)).toEqual(pngBytes);

    result.cleanupAttachments();
    expect(fs.existsSync(result.attachments[0]!.tempPath)).toBe(false);
  });

  it('許可外URLは取得せず、元の本文も変更しない', async () => {
    const externalUrl = 'https://example.com/screenshot.png';
    const downloadImage = createDownloader({});
    const prReview = createPrReview({
      body: `External ![screenshot](${externalUrl})`,
      comments: [{ author: 'commenter', body: `<img src="${externalUrl}" />` }],
    });

    const result = await resolvePrReviewImageAttachments(prReview, {
      cwd: testDir,
      getGithubToken: () => 'gh-token',
      downloadImage,
    });

    expect(downloadImage).not.toHaveBeenCalled();
    expect(result.attachments).toEqual([]);
    expect(result.prReview.body).toBe(prReview.body);
    expect(result.prReview.comments[0]?.body).toBe(prReview.comments[0]?.body);
  });

  it('Content-Typeとmagic bytesが一致しない画像は保存しない', async () => {
    const url = 'https://github.com/user-attachments/assets/not-a-png';
    const downloadImage = createDownloader({
      [url]: { body: jpegBytes, contentType: 'image/png', contentLength: jpegBytes.length },
    });
    const prReview = createPrReview({ body: `Broken ![image](${url})` });

    await expect(resolvePrReviewImageAttachments(prReview, {
      cwd: testDir,
      getGithubToken: () => 'gh-token',
      downloadImage,
    })).rejects.toThrow(/image/i);

    expect(fs.readdirSync(testDir)).toEqual([]);
  });

  it('対応外Content-Typeの画像は保存しない', async () => {
    const url = 'https://github.com/user-attachments/assets/svg-image';
    const svgBytes = Buffer.from('<svg></svg>', 'utf-8');
    const downloadImage = createDownloader({
      [url]: { body: svgBytes, contentType: 'image/svg+xml', contentLength: svgBytes.length },
    });
    const prReview = createPrReview({ body: `Unsupported ![image](${url})` });

    await expect(resolvePrReviewImageAttachments(prReview, {
      cwd: testDir,
      getGithubToken: () => 'gh-token',
      downloadImage,
    })).rejects.toThrow(/image/i);

    expect(fs.readdirSync(testDir)).toEqual([]);
  });

  it('10MiBを超える画像は保存しない', async () => {
    const url = 'https://github.com/user-attachments/assets/too-large';
    const downloadImage = createDownloader({
      [url]: {
        body: pngBytes,
        contentType: 'image/png',
        contentLength: 10 * 1024 * 1024 + 1,
      },
    });
    const prReview = createPrReview({ body: `Large ![image](${url})` });

    await expect(resolvePrReviewImageAttachments(prReview, {
      cwd: testDir,
      getGithubToken: () => 'gh-token',
      downloadImage,
    })).rejects.toThrow(/size|large|10MiB/i);

    expect(fs.readdirSync(testDir)).toEqual([]);
  });

  it.each([
    { name: 'Content-Lengthなし', headers: {} },
    { name: '実体より小さいContent-Length', headers: { 'content-length': String(pngBytes.length) } },
  ])('$name のfetch応答はstream読み込み中に10MiB上限で中断する', async ({ headers }) => {
    const url = 'https://github.com/user-attachments/assets/stream-too-large';
    const chunk = new Uint8Array(1024 * 1024);
    let pullCount = 0;
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount += 1;
        if (pullCount <= 12) {
          controller.enqueue(chunk);
          return;
        }
        controller.close();
      },
      cancel() {
        canceled = true;
      },
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(stream, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        ...headers,
      },
    }));
    const prReview = createPrReview({ body: `Large stream ![image](${url})` });

    await expect(resolvePrReviewImageAttachments(prReview, {
      cwd: testDir,
      getGithubToken: () => 'gh-token',
    })).rejects.toThrow(/size limit/i);

    expect(fetchSpy).toHaveBeenCalledWith(url, {
      headers: { authorization: 'Bearer gh-token' },
    });
    expect(canceled).toBe(true);
    expect(pullCount).toBeLessThan(13);
    expect(fs.readdirSync(testDir)).toEqual([]);
  });
});
