import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(() => 'test-token\n'),
}));

vi.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

afterEach(() => {
  vi.doUnmock('node:fs');
  vi.resetModules();
  vi.clearAllMocks();
});

describe('downloadPrImageAttachments session cleanup', () => {
  it('Given session setup fails after mkdtemp, When download is requested, Then the partial session directory is removed', async () => {
    const removedPaths: string[] = [];
    const sessionDir = '/tmp/takt/pr-images-session';
    let chmodCalls = 0;
    vi.doMock('node:fs', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs')>();
      return {
        ...actual,
        mkdirSync: vi.fn(),
        mkdtempSync: vi.fn(() => sessionDir),
        chmodSync: vi.fn(() => {
          chmodCalls += 1;
          if (chmodCalls === 2) {
            throw new Error('chmod failed');
          }
        }),
        rmSync: vi.fn((target: string) => {
          removedPaths.push(target);
        }),
      };
    });
    const { downloadPrImageAttachments } = await import('../infra/github/prImageAttachments.js');

    await expect(downloadPrImageAttachments([
      {
        url: 'https://github.com/user-attachments/assets/11111111-1111-1111-1111-111111111111',
        placeholder: '[Image #1]',
      },
    ], {
      cwd: '/repo',
      tmpRoot: '/tmp',
    })).rejects.toThrow(/chmod failed/i);

    expect(removedPaths).toEqual([sessionDir]);
  });
});
