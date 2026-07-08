import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrReviewData } from '../infra/git/index.js';

const { mockDownloadGitHubImageAttachment } = vi.hoisted(() => ({
  mockDownloadGitHubImageAttachment: vi.fn(),
}));

vi.mock('../infra/github/attachmentDownload.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  downloadGitHubImageAttachment: (...args: unknown[]) => mockDownloadGitHubImageAttachment(...args),
}));

import { preparePrReviewImageAttachments } from '../features/tasks/prReviewImageAttachments.js';

const githubImageUrl = 'https://github.com/user-attachments/assets/first';
const secondGithubImageUrl = 'https://github.com/org/repo/assets/second';
const privateGithubImageUrl = 'https://private-user-images.githubusercontent.com/1/third.png';
const externalImageUrl = 'https://example.com/not-downloaded.png';

let testDir: string;
const cleanupCallbacks: Array<() => void> = [];

function createPrReview(overrides: Partial<PrReviewData> = {}): PrReviewData {
  return {
    number: 456,
    title: 'Fix screenshots',
    body: 'PR body',
    url: 'https://github.com/org/repo/pull/456',
    headRefName: 'fix/screenshots',
    baseRefName: 'main',
    comments: [],
    reviews: [],
    files: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'takt-pr-review-image-test-'));
  mockDownloadGitHubImageAttachment.mockImplementation(async (url: string) => ({
    data: Buffer.from(`downloaded:${url}`),
    mimeType: 'image/png',
    extension: 'png',
  }));
});

afterEach(() => {
  for (const cleanup of cleanupCallbacks.splice(0)) {
    cleanup();
  }
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

describe('preparePrReviewImageAttachments', () => {
  it('should replace GitHub image syntax across PR body, conversation comments, and review comments', async () => {
    const prReview = createPrReview({
      body: `See ![screenshot](${githubImageUrl}) in the PR description.`,
      comments: [
        { author: 'commenter', body: `Conversation <img alt="shot" src="${secondGithubImageUrl}" />` },
      ],
      reviews: [
        { author: 'reviewer', body: `Thread image: ![image](${privateGithubImageUrl})`, threadState: 'active' },
      ],
    });

    const result = await preparePrReviewImageAttachments(prReview, { cwd: testDir });
    cleanupCallbacks.push(result.cleanupAttachments);

    expect(result.prReview.body).toBe('See [Image #1] in the PR description.');
    expect(result.prReview.comments[0]?.body).toBe('Conversation [Image #2]');
    expect(result.prReview.reviews[0]?.body).toBe('Thread image: [Image #3]');
    expect(result.attachments).toEqual([
      expect.objectContaining({ placeholder: '[Image #1]', fileName: 'image-1.png' }),
      expect.objectContaining({ placeholder: '[Image #2]', fileName: 'image-2.png' }),
      expect.objectContaining({ placeholder: '[Image #3]', fileName: 'image-3.png' }),
    ]);
    expect(result.attachments.map((attachment) => fs.readFileSync(attachment.tempPath, 'utf-8'))).toEqual([
      `downloaded:${githubImageUrl}`,
      `downloaded:${secondGithubImageUrl}`,
      `downloaded:${privateGithubImageUrl}`,
    ]);
    expect(mockDownloadGitHubImageAttachment).toHaveBeenNthCalledWith(1, githubImageUrl, { cwd: testDir });
    expect(mockDownloadGitHubImageAttachment).toHaveBeenNthCalledWith(2, secondGithubImageUrl, { cwd: testDir });
    expect(mockDownloadGitHubImageAttachment).toHaveBeenNthCalledWith(3, privateGithubImageUrl, { cwd: testDir });
  });

  it('should support single-quoted HTML image src attributes', async () => {
    const prReview = createPrReview({
      comments: [
        { author: 'commenter', body: `<img width="400" src='${githubImageUrl}' alt="shot">` },
      ],
    });

    const result = await preparePrReviewImageAttachments(prReview, { cwd: testDir });
    cleanupCallbacks.push(result.cleanupAttachments);

    expect(result.prReview.comments[0]?.body).toBe('[Image #1]');
    expect(result.attachments[0]).toEqual(expect.objectContaining({
      placeholder: '[Image #1]',
      fileName: 'image-1.png',
    }));
  });

  it('should dedupe repeated image URLs and reuse the first placeholder', async () => {
    const prReview = createPrReview({
      body: `First ![one](${githubImageUrl})`,
      comments: [
        { author: 'commenter', body: `Again <img src="${githubImageUrl}" />` },
      ],
      reviews: [
        { author: 'reviewer', body: `Again in review ![dup](${githubImageUrl})`, threadState: 'active' },
      ],
    });

    const result = await preparePrReviewImageAttachments(prReview, { cwd: testDir });
    cleanupCallbacks.push(result.cleanupAttachments);

    expect(result.prReview.body).toBe('First [Image #1]');
    expect(result.prReview.comments[0]?.body).toBe('Again [Image #1]');
    expect(result.prReview.reviews[0]?.body).toBe('Again in review [Image #1]');
    expect(result.attachments).toHaveLength(1);
    expect(mockDownloadGitHubImageAttachment).toHaveBeenCalledTimes(1);
  });

  it('should leave non-GitHub attachment URLs unchanged and avoid fetching them', async () => {
    const prReview = createPrReview({
      body: `External ![diagram](${externalImageUrl})`,
      comments: [
        { author: 'commenter', body: `<img src="${externalImageUrl}" />` },
      ],
    });

    const result = await preparePrReviewImageAttachments(prReview, { cwd: testDir });
    cleanupCallbacks.push(result.cleanupAttachments);

    expect(result.prReview.body).toBe(`External ![diagram](${externalImageUrl})`);
    expect(result.prReview.comments[0]?.body).toBe(`<img src="${externalImageUrl}" />`);
    expect(result.attachments).toEqual([]);
    expect(mockDownloadGitHubImageAttachment).not.toHaveBeenCalled();
  });

  it('should remove downloaded temporary files when cleanupAttachments is called', async () => {
    const prReview = createPrReview({
      body: `See ![screenshot](${githubImageUrl}).`,
    });

    const result = await preparePrReviewImageAttachments(prReview, { cwd: testDir });
    const [attachment] = result.attachments;
    expect(attachment).toBeDefined();
    expect(fs.existsSync(attachment!.tempPath)).toBe(true);

    result.cleanupAttachments();

    expect(fs.existsSync(attachment!.tempPath)).toBe(false);
  });

  it('should keep the original image reference and continue when one image download fails', async () => {
    const prReview = createPrReview({
      body: `First ![ok](${githubImageUrl})`,
      comments: [
        { author: 'commenter', body: `Broken ![bad](${secondGithubImageUrl})` },
      ],
    });
    mockDownloadGitHubImageAttachment.mockImplementation(async (url: string) => {
      if (url === secondGithubImageUrl) {
        throw new Error('HTTP 404');
      }
      return {
        data: Buffer.from(`downloaded:${url}`),
        mimeType: 'image/png',
        extension: 'png',
      };
    });

    const result = await preparePrReviewImageAttachments(prReview, { cwd: testDir });
    cleanupCallbacks.push(result.cleanupAttachments);

    expect(result.prReview.body).toBe('First [Image #1]');
    expect(result.prReview.comments[0]?.body).toBe(`Broken ![bad](${secondGithubImageUrl})`);
    expect(result.attachments).toHaveLength(1);
    expect(mockDownloadGitHubImageAttachment).toHaveBeenCalledTimes(2);
  });

  it('should remove the temporary workspace when a later local write fails before cleanup is returned', async () => {
    const prReview = createPrReview({
      body: `First ![ok](${githubImageUrl})`,
      comments: [
        { author: 'commenter', body: `Second ![fails](${secondGithubImageUrl})` },
      ],
    });
    const tempDirsBefore = new Set(
      fs.readdirSync(os.tmpdir()).filter((entry) => entry.startsWith('takt-pr-review-images-')),
    );
    mockDownloadGitHubImageAttachment.mockImplementation(async (url: string) => ({
      data: Buffer.from(`downloaded:${url}`),
      mimeType: 'image/png',
      extension: url === secondGithubImageUrl ? 'png/missing-directory' : 'png',
    }));

    await expect(preparePrReviewImageAttachments(prReview, { cwd: testDir })).rejects.toThrow();

    const tempDirsAfter = fs.readdirSync(os.tmpdir()).filter((entry) => entry.startsWith('takt-pr-review-images-'));
    const createdDirs = tempDirsAfter.filter((entry) => !tempDirsBefore.has(entry));
    createdDirs.forEach((entry) => {
      cleanupCallbacks.push(() => fs.rmSync(path.join(os.tmpdir(), entry), { recursive: true, force: true }));
    });

    expect(createdDirs).toEqual([]);
  });
});
