import { describe, expect, it } from 'vitest';
import { MAX_PR_REVIEW_IMAGE_REFERENCES } from '../infra/github/prReviewAttachmentLimits.js';
import { extractPrReviewImageReferences } from '../infra/github/prReviewImageReferences.js';
import type { PrReviewData } from '../infra/git/types.js';

const USER_ATTACHMENT_URL = 'https://github.com/user-attachments/assets/11111111-1111-4111-8111-111111111111';
const REPO_ASSET_URL = 'https://github.com/org/repo/assets/22222222-2222-4222-8222-222222222222';
const EXTERNAL_IMAGE_URL = 'https://example.com/screenshot.png';

function createPrReview(overrides: Partial<PrReviewData> = {}): PrReviewData {
  return {
    number: 42,
    title: 'Fix screenshots',
    body: 'PR body',
    url: 'https://github.com/org/repo/pull/42',
    headRefName: 'fix/screenshots',
    baseRefName: 'main',
    comments: [],
    reviews: [],
    files: ['src/app.ts'],
    ...overrides,
  };
}

describe('extractPrReviewImageReferences', () => {
  it('should replace GitHub markdown and HTML image references across PR review data', () => {
    const prReview = createPrReview({
      body: `PR body ![screenshot](${USER_ATTACHMENT_URL})`,
      comments: [
        { author: 'commenter', body: `<img alt="preview" src="${REPO_ASSET_URL}" />` },
      ],
      reviews: [
        { author: 'reviewer', body: `Summary ![same](${USER_ATTACHMENT_URL})` },
        {
          author: 'thread-reviewer',
          body: `<img data-x="1" src='${REPO_ASSET_URL}'>`,
          path: 'src/app.ts',
          line: 12,
          threadState: 'active',
        },
      ],
    });

    const result = extractPrReviewImageReferences(prReview);

    expect(result.references).toEqual([
      { placeholder: '[Image #1]', url: USER_ATTACHMENT_URL },
      { placeholder: '[Image #2]', url: REPO_ASSET_URL },
    ]);
    expect(result.prReview.body).toBe('PR body [Image #1]');
    expect(result.prReview.comments[0]?.body).toBe('[Image #2]');
    expect(result.prReview.reviews[0]?.body).toBe('Summary [Image #1]');
    expect(result.prReview.reviews[1]?.body).toBe('[Image #2]');
  });

  it('should leave non-GitHub image URLs unchanged and exclude them from references', () => {
    const prReview = createPrReview({
      body: `External ![screenshot](${EXTERNAL_IMAGE_URL})`,
      comments: [
        { author: 'commenter', body: `<img src="${EXTERNAL_IMAGE_URL}" />` },
      ],
    });

    const result = extractPrReviewImageReferences(prReview);

    expect(result.references).toEqual([]);
    expect(result.prReview.body).toBe(`External ![screenshot](${EXTERNAL_IMAGE_URL})`);
    expect(result.prReview.comments[0]?.body).toBe(`<img src="${EXTERNAL_IMAGE_URL}" />`);
  });

  it('should not mutate the original PR review data', () => {
    const prReview = createPrReview({
      body: `PR body ![screenshot](${USER_ATTACHMENT_URL})`,
      comments: [{ author: 'commenter', body: `Comment ![image](${REPO_ASSET_URL})` }],
    });

    const result = extractPrReviewImageReferences(prReview);

    expect(result.prReview).not.toBe(prReview);
    expect(result.prReview.comments).not.toBe(prReview.comments);
    expect(prReview.body).toBe(`PR body ![screenshot](${USER_ATTACHMENT_URL})`);
    expect(prReview.comments[0]?.body).toBe(`Comment ![image](${REPO_ASSET_URL})`);
  });

  it('should cap extracted GitHub image references before download', () => {
    const imageUrls = Array.from({ length: MAX_PR_REVIEW_IMAGE_REFERENCES + 1 }, (_, index) =>
      `https://github.com/user-attachments/assets/limit-${index + 1}`,
    );
    const prReview = createPrReview({
      body: imageUrls.map((url, index) => `![image-${index + 1}](${url})`).join('\n'),
    });

    const result = extractPrReviewImageReferences(prReview);

    expect(result.references).toHaveLength(MAX_PR_REVIEW_IMAGE_REFERENCES);
    expect(result.references.at(-1)).toEqual({
      placeholder: `[Image #${MAX_PR_REVIEW_IMAGE_REFERENCES}]`,
      url: imageUrls[MAX_PR_REVIEW_IMAGE_REFERENCES - 1],
    });
    expect(result.references.some((reference) => reference.url === imageUrls[MAX_PR_REVIEW_IMAGE_REFERENCES])).toBe(false);
    expect(result.prReview.body).toContain(`[Image #${MAX_PR_REVIEW_IMAGE_REFERENCES}]`);
    expect(result.prReview.body).toContain(
      `[Image #${MAX_PR_REVIEW_IMAGE_REFERENCES + 1}] download skipped: PR image attachment limit exceeded`,
    );
  });
});
