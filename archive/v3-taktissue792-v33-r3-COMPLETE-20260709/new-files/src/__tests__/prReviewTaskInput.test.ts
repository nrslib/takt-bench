import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GitProvider, PrReviewData } from '../infra/git/index.js';
import { buildPrReviewTaskInput } from '../features/tasks/prReviewTaskInput.js';

const tempRoots = new Set<string>();

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'takt-pr-task-input-test-'));
  tempRoots.add(root);
  return root;
}

function createImageProvider(
  downloadPrImageAttachments: ReturnType<typeof vi.fn>,
): Pick<GitProvider, 'isPrImageAttachmentUrl' | 'downloadPrImageAttachments'> {
  return {
    isPrImageAttachmentUrl: (url) => url.startsWith('https://github.com/'),
    downloadPrImageAttachments: (...args) => downloadPrImageAttachments(...args),
  };
}

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

afterEach(() => {
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.clear();
});

describe('buildPrReviewTaskInput', () => {
  it('Given PR review data with images, When task input is built, Then task text references placeholders and attachments are returned', async () => {
    const tmpRoot = createTempRoot();
    const imagePath = path.join(tmpRoot, 'image-1.png');
    fs.writeFileSync(imagePath, 'png-data', 'utf-8');
    const cleanupAttachments = vi.fn();
    const mockDownloadPrImageAttachments = vi.fn().mockResolvedValue({
      attachments: [{
        placeholder: '[Image #1]',
        tempPath: imagePath,
        fileName: 'image-1.png',
      }],
      cleanupAttachments,
    });

    const result = await buildPrReviewTaskInput(createPrReview({
      body: 'Please inspect ![screenshot](https://github.com/user-attachments/assets/abc).',
      comments: [{ author: 'commenter', body: 'Looks related.' }],
    }), {
      gitProvider: createImageProvider(mockDownloadPrImageAttachments),
      cwd: '/repo',
      tmpRoot,
    });

    expect(mockDownloadPrImageAttachments).toHaveBeenCalledWith(
      [{ url: 'https://github.com/user-attachments/assets/abc', placeholder: '[Image #1]' }],
      expect.objectContaining({ cwd: '/repo', tmpRoot }),
    );
    expect(result.taskContent).toContain('### PR Description');
    expect(result.taskContent).toContain('Please inspect [Image #1].');
    expect(result.taskContent).not.toContain('https://github.com/user-attachments/assets/abc');
    expect(result.attachments).toEqual([{
      placeholder: '[Image #1]',
      tempPath: imagePath,
      fileName: 'image-1.png',
    }]);

    result.cleanupAttachments();

    expect(cleanupAttachments).toHaveBeenCalledTimes(1);
  });

  it('Given PR review data without images, When task input is built, Then downloader is not called and no cleanup owner is exposed', async () => {
    const mockDownloadPrImageAttachments = vi.fn();
    const result = await buildPrReviewTaskInput(createPrReview({
      body: 'No images here.',
      comments: [{ author: 'commenter', body: 'Plain comment.' }],
    }), {
      gitProvider: createImageProvider(mockDownloadPrImageAttachments),
      cwd: '/repo',
      tmpRoot: createTempRoot(),
    });

    expect(mockDownloadPrImageAttachments).not.toHaveBeenCalled();
    expect(result.taskContent).toContain('No images here.');
    expect(result.attachments).toBeUndefined();
    expect(result.cleanupAttachments).toBeUndefined();
  });

  it('Given formatting fails after image download, When task input build fails, Then downloaded attachments are cleaned up', async () => {
    const cleanupAttachments = vi.fn();
    const mockDownloadPrImageAttachments = vi.fn().mockResolvedValue({
      attachments: [{
        placeholder: '[Image #1]',
        tempPath: path.join(createTempRoot(), 'image-1.png'),
        fileName: 'image-1.png',
      }],
      cleanupAttachments,
    });

    await expect(buildPrReviewTaskInput({
      ...createPrReview({
        body: 'Please inspect ![screenshot](https://github.com/user-attachments/assets/abc).',
      }),
      files: undefined as unknown as string[],
    }, {
      gitProvider: createImageProvider(mockDownloadPrImageAttachments),
      cwd: '/repo',
      tmpRoot: createTempRoot(),
    })).rejects.toThrow();

    expect(cleanupAttachments).toHaveBeenCalledTimes(1);
  });
});
