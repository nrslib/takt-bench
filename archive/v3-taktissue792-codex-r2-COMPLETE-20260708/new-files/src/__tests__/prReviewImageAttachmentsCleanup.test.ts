import type * as Fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrReviewData } from '../infra/git/index.js';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

const fsMockState = vi.hoisted(() => ({
  createdSessionDirs: [] as string[],
  failAttachmentChmod: false,
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof Fs>('node:fs');
  return {
    ...actual,
    mkdtempSync: vi.fn((prefix: string) => {
      const sessionDir = actual.mkdtempSync(prefix);
      fsMockState.createdSessionDirs.push(sessionDir);
      return sessionDir;
    }),
    chmodSync: vi.fn((target: Fs.PathLike, mode: Fs.Mode) => {
      const firstSessionDir = fsMockState.createdSessionDirs[0];
      if (
        fsMockState.failAttachmentChmod
        && firstSessionDir !== undefined
        && target === path.join(firstSessionDir, 'attachments')
      ) {
        throw new Error('chmod failed');
      }
      return actual.chmodSync(target, mode);
    }),
  };
});

const fs = await import('node:fs');
const { preparePrReviewImageAttachments } = await import('../features/tasks/prReviewImageAttachments.js');

afterEach(() => {
  for (const sessionDir of fsMockState.createdSessionDirs) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
  fsMockState.createdSessionDirs = [];
  fsMockState.failAttachmentChmod = false;
});

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

describe('preparePrReviewImageAttachments cleanup', () => {
  it('cleans up the temporary session directory when private directory initialization fails', async () => {
    fsMockState.failAttachmentChmod = true;
    const imageUrl = 'https://github.com/user-attachments/assets/init-failure';
    const prReview = createPrReview({ body: `![init](${imageUrl})` });

    await expect(preparePrReviewImageAttachments(prReview, {
      maxBytes: 1024,
      downloadImage: vi.fn(async () => ({
        body: PNG_BYTES,
        contentType: 'image/png',
        finalUrl: imageUrl,
      })),
    })).rejects.toThrow('chmod failed');

    expect(fsMockState.createdSessionDirs).toHaveLength(1);
    expect(fs.existsSync(fsMockState.createdSessionDirs[0]!)).toBe(false);
  });
});
