import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';
import type { PrReviewData } from '../infra/git/index.js';

const {
  mockCheckCliStatus,
  mockFetchPrReviewComments,
  mockDetermineWorkflow,
  mockPreparePrReviewImageAttachments,
} = vi.hoisted(() => ({
  mockCheckCliStatus: vi.fn(),
  mockFetchPrReviewComments: vi.fn(),
  mockDetermineWorkflow: vi.fn(),
  mockPreparePrReviewImageAttachments: vi.fn(),
}));

vi.mock('../shared/ui/index.js', () => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  blankLine: vi.fn(),
  withProgress: vi.fn(async (_start, _done, operation) => operation()),
}));

vi.mock('../shared/prompt/index.js', () => ({
  confirm: vi.fn(),
  promptInput: vi.fn(),
  selectOption: vi.fn(),
}));

vi.mock('../shared/utils/index.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../infra/task/summarize.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  summarizeTaskName: vi.fn().mockResolvedValue('fix-pr-images'),
}));

vi.mock('../infra/task/index.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getCurrentBranch: vi.fn().mockReturnValue('main'),
  branchExists: vi.fn().mockReturnValue(true),
}));

vi.mock('../infra/git/index.js', () => ({
  getGitProvider: () => ({
    checkCliStatus: (...args: unknown[]) => mockCheckCliStatus(...args),
    fetchPrReviewComments: (...args: unknown[]) => mockFetchPrReviewComments(...args),
  }),
  formatPrReviewAsTask: (prReview: PrReviewData) => [
    `## PR #${prReview.number} Review Comments: ${prReview.title}`,
    prReview.body,
    ...prReview.comments.map((comment) => `**${comment.author}**: ${comment.body}`),
    ...prReview.reviews.map((review) => `**${review.author}**: ${review.body}`),
  ].join('\n'),
  isIssueReference: vi.fn(() => false),
  resolveIssueTask: vi.fn(),
  parseIssueNumbers: vi.fn(() => []),
}));

vi.mock('../features/tasks/execute/selectAndExecute.js', () => ({
  determineWorkflow: (...args: unknown[]) => mockDetermineWorkflow(...args),
}));

vi.mock('../features/tasks/prReviewImageAttachments.js', () => ({
  preparePrReviewImageAttachments: (...args: unknown[]) => mockPreparePrReviewImageAttachments(...args),
}));

import { addTask } from '../features/tasks/add/index.js';

let testDir: string;

function createPrReview(overrides: Partial<PrReviewData> = {}): PrReviewData {
  return {
    number: 77,
    title: 'Fix PR screenshots',
    body: 'Raw PR body image',
    url: 'https://github.com/org/repo/pull/77',
    headRefName: 'fix/pr-screenshots',
    baseRefName: 'main',
    comments: [{ author: 'reviewer', body: 'Raw comment image' }],
    reviews: [],
    files: ['src/app.ts'],
    ...overrides,
  };
}

function createTempAttachment(fileName: string, content: string) {
  const attachmentDir = path.join(testDir, 'tmp-attachments');
  fs.mkdirSync(attachmentDir, { recursive: true });
  const tempPath = path.join(attachmentDir, fileName);
  fs.writeFileSync(tempPath, content, 'utf-8');
  return {
    placeholder: '[Image #1]',
    tempPath,
    fileName,
  };
}

function loadTasks(): { tasks: Array<Record<string, unknown>> } {
  return parseYaml(fs.readFileSync(path.join(testDir, '.takt', 'tasks.yaml'), 'utf-8')) as {
    tasks: Array<Record<string, unknown>>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-02-10T04:40:00.000Z'));
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'takt-add-pr-attachments-test-'));
  mockCheckCliStatus.mockReturnValue({ available: true });
  mockDetermineWorkflow.mockResolvedValue('default');
});

afterEach(() => {
  vi.useRealTimers();
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
});

describe('addTask --pr image attachments', () => {
  it('should save downloaded PR image attachments into the generated task directory', async () => {
    const rawPrReview = createPrReview();
    const normalizedPrReview = createPrReview({
      body: 'Normalized PR body [Image #1]',
      comments: [{ author: 'reviewer', body: 'Normalized comment [Image #1]' }],
    });
    const attachment = createTempAttachment('image-1.png', 'downloaded-image');
    const cleanupAttachments = vi.fn();
    mockFetchPrReviewComments.mockReturnValue(rawPrReview);
    mockPreparePrReviewImageAttachments.mockReturnValue({
      prReview: normalizedPrReview,
      attachments: [attachment],
      cleanupAttachments,
    });

    await addTask(testDir, undefined, { prNumber: 77, workflow: 'default' });

    expect(mockPreparePrReviewImageAttachments).toHaveBeenCalledWith(rawPrReview, { cwd: testDir });
    expect(cleanupAttachments).toHaveBeenCalledTimes(1);
    const task = loadTasks().tasks[0]!;
    expect(task.source).toBe('pr_review');
    expect(task.pr_number).toBe(77);
    const taskDir = path.join(testDir, String(task.task_dir));
    const orderContent = fs.readFileSync(path.join(taskDir, 'order.md'), 'utf-8');
    expect(orderContent).toContain('Normalized PR body [Image #1]');
    expect(orderContent).toContain('Normalized comment [Image #1]');
    expect(orderContent).toContain('## 添付画像');
    expect(orderContent).toContain('- [Image #1]: `attachments/image-1.png`');
    expect(fs.readFileSync(path.join(taskDir, 'attachments', 'image-1.png'), 'utf-8')).toBe('downloaded-image');
  });

  it('should create a PR task when only the PR body contains an image attachment', async () => {
    const rawPrReview = createPrReview({
      body: 'Raw PR body image only',
      comments: [],
      reviews: [],
    });
    const normalizedPrReview = createPrReview({
      body: 'Normalized body [Image #1]',
      comments: [],
      reviews: [],
    });
    const attachment = createTempAttachment('image-1.png', 'body-image');
    const cleanupAttachments = vi.fn();
    mockFetchPrReviewComments.mockReturnValue(rawPrReview);
    mockPreparePrReviewImageAttachments.mockReturnValue({
      prReview: normalizedPrReview,
      attachments: [attachment],
      cleanupAttachments,
    });

    await addTask(testDir, undefined, { prNumber: 77, workflow: 'default' });

    expect(mockPreparePrReviewImageAttachments).toHaveBeenCalledWith(rawPrReview, { cwd: testDir });
    const task = loadTasks().tasks[0]!;
    const taskDir = path.join(testDir, String(task.task_dir));
    const orderContent = fs.readFileSync(path.join(taskDir, 'order.md'), 'utf-8');
    expect(orderContent).toContain('Normalized body [Image #1]');
    expect(orderContent).toContain('- [Image #1]: `attachments/image-1.png`');
    expect(fs.readFileSync(path.join(taskDir, 'attachments', 'image-1.png'), 'utf-8')).toBe('body-image');
    expect(cleanupAttachments).toHaveBeenCalledTimes(1);
  });
});
