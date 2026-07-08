import { describe, expect, it, vi } from 'vitest';
import {
  preparePrReviewTaskWithImageAttachments,
  type PrReviewImageDownloader,
} from '../features/tasks/prReviewImageAttachments.js';
import type { PrReviewData } from '../infra/git/index.js';

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

describe('preparePrReviewTaskWithImageAttachments', () => {
  it('should replace GitHub Markdown and HTML image references with stable placeholders', async () => {
    const firstUrl = 'https://github.com/user-attachments/assets/11111111-1111-4111-8111-111111111111';
    const secondUrl = 'https://github.com/org/repo/assets/22222222-2222-4222-8222-222222222222';
    const downloaded = new Map([
      [firstUrl, { tempPath: '/tmp/takt-pr-images/first.png', mimeType: 'image/png' as const }],
      [secondUrl, { tempPath: '/tmp/takt-pr-images/second.webp', mimeType: 'image/webp' as const }],
    ]);
    const downloadImageAttachment: PrReviewImageDownloader = vi.fn(async (url: string) => {
      const result = downloaded.get(url);
      if (!result) {
        throw new Error(`Unexpected URL: ${url}`);
      }
      return result;
    });
    const prReview = createPrReview({
      body: `Body screenshot ![screenshot](${firstUrl})`,
      comments: [
        { author: 'commenter', body: `HTML image <img alt="actual" src="${secondUrl}" />` },
      ],
      reviews: [
        { author: 'reviewer', body: `Duplicate reference ![again](${firstUrl})` },
        { author: 'threader', body: `Thread has <img src='${secondUrl}'>`, path: 'src/auth.ts', line: 12, threadState: 'active' },
      ],
    });

    const result = await preparePrReviewTaskWithImageAttachments({
      cwd: '/repo',
      prReview,
      downloadImageAttachment,
    });

    expect(downloadImageAttachment).toHaveBeenCalledTimes(2);
    expect(downloadImageAttachment).toHaveBeenNthCalledWith(1, firstUrl, { cwd: '/repo', imageNumber: 1 });
    expect(downloadImageAttachment).toHaveBeenNthCalledWith(2, secondUrl, { cwd: '/repo', imageNumber: 2 });
    expect(result.attachments).toEqual([
      { placeholder: '[Image #1]', tempPath: '/tmp/takt-pr-images/first.png', fileName: 'image-1.png' },
      { placeholder: '[Image #2]', tempPath: '/tmp/takt-pr-images/second.webp', fileName: 'image-2.webp' },
    ]);
    expect(result.taskContent).toContain('Body screenshot [Image #1]');
    expect(result.taskContent).toContain('HTML image [Image #2]');
    expect(result.taskContent).toContain('Duplicate reference [Image #1]');
    expect(result.taskContent).toContain('Thread has [Image #2]');
    expect(result.taskContent).not.toContain('![');
    expect(result.taskContent).not.toContain('<img');
  });

  it('should leave non-GitHub image URLs untouched and avoid downloading them', async () => {
    const githubUrl = 'https://github.com/user-attachments/assets/33333333-3333-4333-8333-333333333333';
    const externalUrl = 'https://example.com/screenshot.png';
    const downloadImageAttachment: PrReviewImageDownloader = vi.fn(async () => ({
      tempPath: '/tmp/takt-pr-images/third.jpg',
      mimeType: 'image/jpeg',
    }));
    const prReview = createPrReview({
      comments: [
        { author: 'commenter', body: `Allowed ![ok](${githubUrl}) and external ![skip](${externalUrl})` },
      ],
    });

    const result = await preparePrReviewTaskWithImageAttachments({
      cwd: '/repo',
      prReview,
      downloadImageAttachment,
    });

    expect(downloadImageAttachment).toHaveBeenCalledTimes(1);
    expect(downloadImageAttachment).toHaveBeenCalledWith(githubUrl, { cwd: '/repo', imageNumber: 1 });
    expect(result.attachments).toEqual([
      { placeholder: '[Image #1]', tempPath: '/tmp/takt-pr-images/third.jpg', fileName: 'image-1.jpg' },
    ]);
    expect(result.taskContent).toContain('Allowed [Image #1]');
    expect(result.taskContent).toContain(`external ![skip](${externalUrl})`);
  });

  it('should return the formatted PR task unchanged when no allowed image URL exists', async () => {
    const downloadImageAttachment: PrReviewImageDownloader = vi.fn();
    const prReview = createPrReview({
      body: 'Plain description',
      comments: [{ author: 'commenter', body: 'No screenshots here' }],
      reviews: [{ author: 'reviewer', body: 'Looks good' }],
    });

    const result = await preparePrReviewTaskWithImageAttachments({
      cwd: '/repo',
      prReview,
      downloadImageAttachment,
    });

    expect(downloadImageAttachment).not.toHaveBeenCalled();
    expect(result.attachments).toEqual([]);
    expect(result.taskContent).toContain('## PR #456 Review Comments: Fix auth bug');
    expect(result.taskContent).toContain('Plain description');
    expect(result.taskContent).toContain('No screenshots here');
    expect(result.taskContent).toContain('Looks good');
  });
});
