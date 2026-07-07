import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitProvider, PrReviewData } from '../infra/git/types.js';

const {
  mockDownloadGitHubAttachmentImage,
  mockSaveImage,
  mockCleanup,
} = vi.hoisted(() => ({
  mockDownloadGitHubAttachmentImage: vi.fn(),
  mockSaveImage: vi.fn(),
  mockCleanup: vi.fn(),
}));

vi.mock('../shared/utils/imageAttachmentStore.js', () => ({
  cleanupImageAttachmentStore: (store: { cleanup: () => void }) => {
    try {
      store.cleanup();
    } catch {
      // mirrors the production cleanup contract: cleanup failure must not replace the main result.
    }
  },
  createSessionImageAttachmentStore: () => {
    let attachments: Array<{ placeholder: string; tempPath: string; fileName: string }> = [];
    return {
      async saveImage(...args: unknown[]) {
        const attachment = await mockSaveImage(...args);
        attachments = [...attachments, attachment];
        return attachment;
      },
      listAttachments: () => [...attachments],
      cleanup: () => mockCleanup(),
    };
  },
}));

const { resolvePrReviewImageAttachments } = await import('../features/tasks/prReviewImageAttachments.js');

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

function createProvider(): GitProvider {
  return {
    checkCliStatus: vi.fn(),
    fetchIssue: vi.fn(),
    createIssue: vi.fn(),
    closeIssue: vi.fn(),
    fetchPrReviewComments: vi.fn(),
    isPrReviewImageAttachmentUrl: (url: string) => (
      url.startsWith('https://github.com/user-attachments/assets/')
      || /^https:\/\/github\.com\/[^/]+\/[^/]+\/assets\//.test(url)
      || url.startsWith('https://user-images.githubusercontent.com/')
      || url.startsWith('https://private-user-images.githubusercontent.com/')
    ),
    downloadPrReviewImageAttachment: (...args: [string, string | undefined]) => mockDownloadGitHubAttachmentImage(...args),
    listOpenIssues: vi.fn(),
    listOpenPrs: vi.fn(),
    findExistingPr: vi.fn(),
    createPullRequest: vi.fn(),
    commentOnPr: vi.fn(),
    closePr: vi.fn(),
    mergePr: vi.fn(),
  };
}

describe('resolvePrReviewImageAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDownloadGitHubAttachmentImage.mockImplementation(async (url: string) => ({
      data: Buffer.from(`bytes:${url}`),
      mimeType: url.includes('comment-image') ? 'image/jpeg' : 'image/png',
    }));
    mockSaveImage.mockImplementation(async (_data: Buffer, mimeType: string) => {
      const index = mockSaveImage.mock.calls.length;
      const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      const attachment = {
        placeholder: `[Image #${index}]`,
        tempPath: `/tmp/image-${index}.${extension}`,
        fileName: `image-${index}.${extension}`,
      };
      return attachment;
    });
  });

  it('should replace PR body, conversation comment, review summary, and review thread image references with attachment placeholders', async () => {
    const bodyImageUrl = 'https://github.com/user-attachments/assets/body-image';
    const commentImageUrl = 'https://github.com/org/repo/assets/comment-image';
    const externalImageUrl = 'https://example.com/not-downloaded.png';
    const prReview = createPrReview({
      body: `Body screenshot: ![body](${bodyImageUrl})`,
      comments: [{
        author: 'commenter',
        body: `Comment screenshot: <img alt="comment" src="${commentImageUrl}" />`,
      }],
      reviews: [
        {
          author: 'reviewer',
          body: `Review repeats body screenshot: ![again](${bodyImageUrl})`,
        },
        {
          author: 'thread-reviewer',
          body: `External image stays unchanged: ![external](${externalImageUrl})`,
          path: 'src/auth.ts',
          line: 42,
          threadState: 'active',
        },
      ],
    });

    const result = await resolvePrReviewImageAttachments(prReview, '/repo', createProvider());

    expect(result.prReview).not.toBe(prReview);
    expect(result.prReview.body).toBe('Body screenshot: [Image #1]');
    expect(result.prReview.comments[0]?.body).toBe('Comment screenshot: [Image #2]');
    expect(result.prReview.reviews[0]?.body).toBe('Review repeats body screenshot: [Image #1]');
    expect(result.prReview.reviews[1]?.body).toContain(`![external](${externalImageUrl})`);
    expect(prReview.body).toContain(bodyImageUrl);
    expect(result.attachments).toEqual([
      { placeholder: '[Image #1]', tempPath: '/tmp/image-1.png', fileName: 'image-1.png' },
      { placeholder: '[Image #2]', tempPath: '/tmp/image-2.jpg', fileName: 'image-2.jpg' },
    ]);
    expect(mockDownloadGitHubAttachmentImage).toHaveBeenCalledTimes(2);
    expect(mockDownloadGitHubAttachmentImage).toHaveBeenNthCalledWith(1, bodyImageUrl, '/repo');
    expect(mockDownloadGitHubAttachmentImage).toHaveBeenNthCalledWith(2, commentImageUrl, '/repo');
    expect(mockSaveImage).toHaveBeenCalledTimes(2);
  });

  it('should replace HTML img tags with single-quoted and unquoted src attributes', async () => {
    const firstUrl = 'https://user-images.githubusercontent.com/123/first.png';
    const secondUrl = 'https://private-user-images.githubusercontent.com/123/second.png';
    const prReview = createPrReview({
      body: `<img src='${firstUrl}'> and <img src=${secondUrl} />`,
      comments: [{ author: 'commenter', body: 'No image here' }],
    });

    const result = await resolvePrReviewImageAttachments(prReview, '/repo', createProvider());

    expect(result.prReview.body).toBe('[Image #1] and [Image #2]');
    expect(result.attachments.map((attachment) => attachment.placeholder)).toEqual(['[Image #1]', '[Image #2]']);
    expect(mockDownloadGitHubAttachmentImage).toHaveBeenNthCalledWith(1, firstUrl, '/repo');
    expect(mockDownloadGitHubAttachmentImage).toHaveBeenNthCalledWith(2, secondUrl, '/repo');
  });

  it('should fail fast and cleanup temporary attachments when an allowlisted image download fails', async () => {
    const imageUrl = 'https://github.com/user-attachments/assets/failing-image';
    mockDownloadGitHubAttachmentImage.mockRejectedValueOnce(new Error('download failed'));
    const prReview = createPrReview({
      body: `![image](${imageUrl})`,
      comments: [{ author: 'commenter', body: 'review comment keeps task eligible' }],
    });

    await expect(resolvePrReviewImageAttachments(prReview, '/repo', createProvider())).rejects.toThrow('download failed');

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('should preserve the original image resolution error when cleanup fails', async () => {
    const imageUrl = 'https://github.com/user-attachments/assets/failing-image';
    mockDownloadGitHubAttachmentImage.mockRejectedValueOnce(new Error('download failed'));
    mockCleanup.mockImplementationOnce(() => {
      throw new Error('cleanup failed');
    });
    const prReview = createPrReview({
      body: `![image](${imageUrl})`,
      comments: [{ author: 'commenter', body: 'review comment keeps task eligible' }],
    });

    await expect(resolvePrReviewImageAttachments(prReview, '/repo', createProvider())).rejects.toThrow('download failed');

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('should expose cleanup for successful temporary attachment stores', async () => {
    const imageUrl = 'https://github.com/user-attachments/assets/body-image';
    const prReview = createPrReview({
      body: `![image](${imageUrl})`,
      comments: [{ author: 'commenter', body: 'review comment keeps task eligible' }],
    });

    const result = await resolvePrReviewImageAttachments(prReview, '/repo', createProvider());
    result.cleanup();
    result.cleanup();

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('should not throw when successful cleanup fails after returning attachments', async () => {
    const imageUrl = 'https://github.com/user-attachments/assets/body-image';
    const prReview = createPrReview({
      body: `![image](${imageUrl})`,
      comments: [{ author: 'commenter', body: 'review comment keeps task eligible' }],
    });
    mockCleanup.mockImplementationOnce(() => {
      throw new Error('cleanup failed');
    });

    const result = await resolvePrReviewImageAttachments(prReview, '/repo', createProvider());

    expect(() => result.cleanup()).not.toThrow();
    expect(result.attachments).toEqual([
      { placeholder: '[Image #1]', tempPath: '/tmp/image-1.png', fileName: 'image-1.png' },
    ]);
    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });
});
