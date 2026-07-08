import * as fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { resolvePrReviewImageAttachments } from '../features/tasks/prReviewImageAttachments.js';
import type { PrReviewData } from '../infra/git/index.js';

const PNG_DATA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function createPrReview(overrides: Partial<PrReviewData> = {}): PrReviewData {
  return {
    number: 42,
    title: 'Review screenshots',
    body: '',
    url: 'https://github.com/org/repo/pull/42',
    headRefName: 'feature/screenshots',
    baseRefName: 'main',
    comments: [],
    reviews: [],
    files: ['src/app.ts'],
    ...overrides,
  };
}

function createDownloader() {
  return vi.fn(async (_options: { url: string }) => ({
    data: PNG_DATA,
    contentType: 'image/png' as const,
  }));
}

describe('resolvePrReviewImageAttachments', () => {
  it('Given PR body comments summaries and review threads with images, When resolving attachments, Then it downloads and replaces references in source order', async () => {
    const urls = [
      'https://github.com/user-attachments/assets/body-image',
      'https://github.com/user-attachments/assets/comment-image',
      'https://github.com/user-attachments/assets/summary-image',
      'https://github.com/user-attachments/assets/thread-image',
    ];
    const prReview = createPrReview({
      body: `Body ![body screenshot](${urls[0]})`,
      comments: [{ author: 'commenter', body: `Comment <img alt="comment" src="${urls[1]}" />` }],
      reviews: [
        { author: 'reviewer', body: `Summary ![summary](${urls[2]})` },
        { author: 'reviewer', body: `Thread <img src='${urls[3]}' />`, path: 'src/app.ts', line: 12, threadState: 'active' },
      ],
    });
    const downloadImage = createDownloader();

    const result = await resolvePrReviewImageAttachments(prReview, {
      downloadImage,
    });

    expect(downloadImage.mock.calls.map((call) => call[0].url)).toEqual(urls);
    expect(result.attachments).toEqual([
      { placeholder: '[Image #1]', tempPath: expect.stringContaining('image-1.png'), fileName: 'image-1.png' },
      { placeholder: '[Image #2]', tempPath: expect.stringContaining('image-2.png'), fileName: 'image-2.png' },
      { placeholder: '[Image #3]', tempPath: expect.stringContaining('image-3.png'), fileName: 'image-3.png' },
      { placeholder: '[Image #4]', tempPath: expect.stringContaining('image-4.png'), fileName: 'image-4.png' },
    ]);
    for (const attachment of result.attachments) {
      expect(fs.readFileSync(attachment.tempPath)).toEqual(PNG_DATA);
    }
    expect(result.prReview.body).toBe('Body [Image #1]');
    expect(result.prReview.comments[0]?.body).toBe('Comment [Image #2]');
    expect(result.prReview.reviews[0]?.body).toBe('Summary [Image #3]');
    expect(result.prReview.reviews[1]?.body).toBe('Thread [Image #4]');
    result.cleanupAttachments?.();
  });

  it('Given the same image URL appears multiple times, When resolving attachments, Then it downloads once and reuses one placeholder', async () => {
    const url = 'https://github.com/user-attachments/assets/shared-image';
    const prReview = createPrReview({
      body: `First ![one](${url})`,
      comments: [{ author: 'commenter', body: `Again ![two](${url})` }],
    });
    const downloadImage = createDownloader();

    const result = await resolvePrReviewImageAttachments(prReview, {
      downloadImage,
    });

    expect(downloadImage).toHaveBeenCalledTimes(1);
    expect(result.attachments).toEqual([
      { placeholder: '[Image #1]', tempPath: expect.stringContaining('image-1.png'), fileName: 'image-1.png' },
    ]);
    expect(result.prReview.body).toBe('First [Image #1]');
    expect(result.prReview.comments[0]?.body).toBe('Again [Image #1]');
    result.cleanupAttachments?.();
  });

  it('Given external image URLs are mixed with GitHub attachments, When resolving attachments, Then it preserves external markup and downloads only supported URLs', async () => {
    const githubUrl = 'https://github.com/user-attachments/assets/supported-image';
    const externalUrl = 'https://example.com/badge.png';
    const prReview = createPrReview({
      body: `Supported ![screenshot](${githubUrl}) external ![badge](${externalUrl})`,
      comments: [{ author: 'commenter', body: `<img src="${externalUrl}" />` }],
    });
    const downloadImage = createDownloader();

    const result = await resolvePrReviewImageAttachments(prReview, {
      isSupportedImageUrl: (url) => url.includes('github.com/user-attachments/assets/'),
      downloadImage,
    });

    expect(downloadImage).toHaveBeenCalledTimes(1);
    expect(downloadImage.mock.calls[0]?.[0].url).toBe(githubUrl);
    expect(result.attachments).toEqual([
      { placeholder: '[Image #1]', tempPath: expect.stringContaining('image-1.png'), fileName: 'image-1.png' },
    ]);
    expect(result.prReview.body).toBe(`Supported [Image #1] external ![badge](${externalUrl})`);
    expect(result.prReview.comments[0]?.body).toBe(`<img src="${externalUrl}" />`);
    result.cleanupAttachments?.();
  });

  it('Given PR text without image markup, When resolving attachments, Then it preserves review data and does not download', async () => {
    const prReview = createPrReview({
      body: 'No image here',
      comments: [{ author: 'commenter', body: 'Plain comment' }],
      reviews: [{ author: 'reviewer', body: 'Plain summary' }],
    });
    const downloadImage = createDownloader();

    const result = await resolvePrReviewImageAttachments(prReview, {
      downloadImage,
    });

    expect(downloadImage).not.toHaveBeenCalled();
    expect(result.prReview).toEqual(prReview);
    expect(result.attachments).toEqual([]);
    expect(result.cleanupAttachments).toBeUndefined();
  });
});
