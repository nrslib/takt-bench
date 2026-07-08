import { describe, expect, it } from 'vitest';
import type { PrReviewData } from '../infra/git/index.js';
import { extractPrImageReferences } from '../infra/git/prImageReferences.js';

function createPrReview(overrides: Partial<PrReviewData> = {}): PrReviewData {
  return {
    number: 123,
    title: 'Review screenshots',
    body: '',
    url: 'https://github.com/org/repo/pull/123',
    headRefName: 'feature/screenshots',
    comments: [],
    reviews: [],
    files: [],
    ...overrides,
  };
}

function isAttachmentUrl(url: string): boolean {
  return url.startsWith('https://github.com/')
    || url.startsWith('https://private-user-images.githubusercontent.com/');
}

describe('extractPrImageReferences', () => {
  it('Given Markdown and HTML GitHub image references across PR review data, When extracted, Then references are ordered and bodies use placeholders', () => {
    const firstUrl = 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111';
    const secondUrl = 'https://github.com/org/repo/assets/22222222-2222-2222-2222-222222222222';
    const thirdUrl = 'https://private-user-images.githubusercontent.com/123456/33333333-3333-3333-3333-333333333333.png';
    const prReview = createPrReview({
      body: `PR body ![screenshot](${firstUrl})`,
      comments: [{ author: 'commenter', body: `<img alt="comment" src="${secondUrl}" />` }],
      reviews: [{ author: 'reviewer', body: `Review summary <img src=${thirdUrl}>` }],
    });

    const result = extractPrImageReferences(prReview, isAttachmentUrl);

    expect(result.references).toEqual([
      { url: firstUrl, placeholder: '[Image #1]' },
      { url: secondUrl, placeholder: '[Image #2]' },
      { url: thirdUrl, placeholder: '[Image #3]' },
    ]);
    expect(result.prReview.body).toBe('PR body [Image #1]');
    expect(result.prReview.comments[0]?.body).toBe('[Image #2]');
    expect(result.prReview.reviews[0]?.body).toBe('Review summary [Image #3]');
  });

  it('Given the same GitHub image appears more than once, When extracted, Then it is downloaded once and all occurrences share the placeholder', () => {
    const url = 'https://github.com/user-attachments/assets/reused-image';
    const prReview = createPrReview({
      body: `First ![one](${url})`,
      comments: [{ author: 'commenter', body: `Again <img src="${url}" />` }],
    });

    const result = extractPrImageReferences(prReview, isAttachmentUrl);

    expect(result.references).toEqual([{ url, placeholder: '[Image #1]' }]);
    expect(result.prReview.body).toBe('First [Image #1]');
    expect(result.prReview.comments[0]?.body).toBe('Again [Image #1]');
  });

  it('Given external image URLs, When extracted, Then they are not converted into download references', () => {
    const externalUrl = 'https://example.com/screenshot.png';
    const prReview = createPrReview({
      body: `External ![screenshot](${externalUrl})`,
      comments: [{ author: 'commenter', body: '<img src="https://cdn.example.com/image.png">' }],
    });

    const result = extractPrImageReferences(prReview, isAttachmentUrl);

    expect(result.references).toEqual([]);
    expect(result.prReview.body).toBe(`External ![screenshot](${externalUrl})`);
    expect(result.prReview.comments[0]?.body).toBe('<img src="https://cdn.example.com/image.png">');
  });
});
