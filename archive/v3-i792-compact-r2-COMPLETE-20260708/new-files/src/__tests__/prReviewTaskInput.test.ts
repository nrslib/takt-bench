import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PrReviewData } from '../infra/git/index.js';
import type { TaskAttachment } from '../features/tasks/attachments.js';

const mockResolvePrReviewImageAttachments = vi.fn();
const mockFormatPrReviewAsTask = vi.fn();

vi.mock('../features/tasks/prReviewImageAttachments.js', () => ({
  resolvePrReviewImageAttachments: (...args: unknown[]) => mockResolvePrReviewImageAttachments(...args),
}));

vi.mock('../infra/git/index.js', () => ({
  formatPrReviewAsTask: (...args: unknown[]) => mockFormatPrReviewAsTask(...args),
}));

import { buildPrReviewTaskInput } from '../features/tasks/prReviewTaskInput.js';

const attachment: TaskAttachment = {
  placeholder: '[Image #1]',
  tempPath: '/tmp/takt-pr-images/image-1.png',
  fileName: 'image-1.png',
};

function createPrReview(overrides: Partial<PrReviewData> = {}): PrReviewData {
  return {
    number: 42,
    title: 'Review images',
    body: 'Original body ![image](https://github.com/user-attachments/assets/a)',
    url: 'https://github.com/org/repo/pull/42',
    headRefName: 'feature/review-images',
    baseRefName: 'main',
    comments: [{ author: 'commenter', body: 'Original comment' }],
    reviews: [],
    files: ['src/app.ts'],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildPrReviewTaskInput', () => {
  it('画像置換済みPRデータをformatterへ渡し、attachmentsとcleanupを呼び出し元へ返す', async () => {
    const originalPrReview = createPrReview();
    const replacedPrReview = createPrReview({
      body: 'Original body [Image #1]',
      comments: [{ author: 'commenter', body: 'Original comment' }],
    });
    const cleanupAttachments = vi.fn();
    mockResolvePrReviewImageAttachments.mockResolvedValue({
      prReview: replacedPrReview,
      attachments: [attachment],
      cleanupAttachments,
    });
    mockFormatPrReviewAsTask.mockReturnValue('Formatted task with [Image #1]');

    const result = await buildPrReviewTaskInput(originalPrReview, '/repo');

    expect(mockResolvePrReviewImageAttachments).toHaveBeenCalledWith(originalPrReview, expect.objectContaining({
      cwd: '/repo',
    }));
    expect(mockFormatPrReviewAsTask).toHaveBeenCalledWith(replacedPrReview);
    expect(result).toEqual({
      taskContent: 'Formatted task with [Image #1]',
      prBranch: 'feature/review-images',
      prBaseBranch: 'main',
      attachments: [attachment],
      cleanupAttachments,
    });
  });

  it('元のPrReviewDataを変更せずに置換結果だけをtask本文化する', async () => {
    const originalPrReview = createPrReview();
    const replacedPrReview = createPrReview({ body: 'Original body [Image #1]' });
    mockResolvePrReviewImageAttachments.mockResolvedValue({
      prReview: replacedPrReview,
      attachments: [attachment],
      cleanupAttachments: vi.fn(),
    });
    mockFormatPrReviewAsTask.mockReturnValue('Formatted task with [Image #1]');

    await buildPrReviewTaskInput(originalPrReview, '/repo');

    expect(originalPrReview.body).toBe('Original body ![image](https://github.com/user-attachments/assets/a)');
    expect(mockFormatPrReviewAsTask).not.toHaveBeenCalledWith(originalPrReview);
  });
});
