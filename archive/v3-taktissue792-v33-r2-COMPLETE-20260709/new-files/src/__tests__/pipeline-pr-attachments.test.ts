import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrReviewData } from '../infra/git/index.js';
import type { TaskAttachment } from '../features/tasks/attachments.js';

const {
  mockCheckCliStatus,
  mockFetchPrReviewComments,
  mockFormatPrReviewAsTask,
  mockResolvePrReviewImageAttachments,
  mockExecuteTask,
} = vi.hoisted(() => ({
  mockCheckCliStatus: vi.fn(),
  mockFetchPrReviewComments: vi.fn(),
  mockFormatPrReviewAsTask: vi.fn(),
  mockResolvePrReviewImageAttachments: vi.fn(),
  mockExecuteTask: vi.fn(),
}));

vi.mock('../infra/git/index.js', () => ({
  getGitProvider: () => ({
    checkCliStatus: (...args: unknown[]) => mockCheckCliStatus(...args),
    fetchPrReviewComments: (...args: unknown[]) => mockFetchPrReviewComments(...args),
  }),
  formatIssueAsTask: vi.fn(),
  formatPrReviewAsTask: (...args: unknown[]) => mockFormatPrReviewAsTask(...args),
}));

vi.mock('../features/tasks/prReviewImageAttachments.js', () => ({
  resolvePrReviewImageAttachments: (...args: unknown[]) => mockResolvePrReviewImageAttachments(...args),
}));

vi.mock('../features/tasks/execute/taskExecution.js', () => ({
  executeTask: (...args: unknown[]) => mockExecuteTask(...args),
}));

vi.mock('../infra/config/index.js', () => ({
  resolveConfigValue: vi.fn(() => undefined),
  resolveConfigValues: vi.fn(() => ({ pipeline: undefined })),
}));

vi.mock('../infra/task/index.js', () => ({
  stageAndCommit: vi.fn(),
  resolveBaseBranch: vi.fn(() => ({ branch: 'main' })),
  resolveBaseBranchName: vi.fn(() => 'main'),
  pushBranch: vi.fn(),
  checkoutBranch: vi.fn(),
  getCurrentBranch: vi.fn(() => 'main'),
  buildTaskInstruction: vi.fn((_taskDir: string, orderFile: string) => `Primary spec: \`${orderFile}\`.`),
}));

vi.mock('../shared/ui/index.js', () => ({
  info: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  status: vi.fn(),
  blankLine: vi.fn(),
}));

vi.mock('../shared/ui/StatusLine.js', () => ({
  statusLine: {
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock('../shared/utils/index.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

const { resolveTaskContent, runWorkflow } = await import('../features/pipeline/steps.js');
const { executePipeline } = await import('../features/pipeline/execute.js');

const tempRoots = new Set<string>();

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckCliStatus.mockReturnValue({ available: true });
  mockResolvePrReviewImageAttachments.mockImplementation(async (prReview: PrReviewData) => ({
    prReview,
    attachments: [],
  }));
  mockExecuteTask.mockResolvedValue(true);
});

afterEach(() => {
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.clear();
});

function createTempProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'takt-pipeline-pr-images-test-'));
  tempRoots.add(root);
  return root;
}

function createPrReview(overrides: Partial<PrReviewData> = {}): PrReviewData {
  return {
    number: 456,
    title: 'Fix auth bug',
    body: 'PR description',
    url: 'https://github.com/org/repo/pull/456',
    headRefName: 'feature/fix-auth-bug',
    baseRefName: 'main',
    comments: [{ author: 'commenter', body: 'Please update tests' }],
    reviews: [{ author: 'reviewer', body: 'Fix null check' }],
    files: ['src/auth.ts'],
    ...overrides,
  };
}

function createAttachment(projectDir: string, content: string): TaskAttachment {
  const attachmentDir = path.join(projectDir, 'tmp-pr-images');
  fs.mkdirSync(attachmentDir, { recursive: true });
  const tempPath = path.join(attachmentDir, 'image-1.png');
  fs.writeFileSync(tempPath, content, 'utf-8');
  return {
    placeholder: '[Image #1]',
    tempPath,
    fileName: 'image-1.png',
  };
}

describe('pipeline PR image attachments', () => {
  it('should preserve PR image attachments when resolving --pr task content', async () => {
    const projectDir = createTempProject();
    const attachment = createAttachment(projectDir, 'png-data');
    const cleanupAttachments = vi.fn();
    const prReview = createPrReview({
      body: 'PR description ![screenshot](https://github.com/user-attachments/assets/abc)',
    });
    const normalizedPrReview = createPrReview({
      body: 'PR description [Image #1]',
    });
    mockFetchPrReviewComments.mockReturnValue(prReview);
    mockResolvePrReviewImageAttachments.mockResolvedValue({
      prReview: normalizedPrReview,
      attachments: [attachment],
      cleanupAttachments,
    });
    mockFormatPrReviewAsTask.mockReturnValue('formatted PR task with [Image #1]');

    const taskContent = await resolveTaskContent({
      cwd: projectDir,
      workflow: 'default',
      prNumber: 456,
      autoPr: false,
      draftPr: false,
      skipGit: true,
    });

    expect(mockFetchPrReviewComments).toHaveBeenCalledWith(456, projectDir);
    expect(mockResolvePrReviewImageAttachments).toHaveBeenCalledWith(prReview, expect.objectContaining({
      cwd: projectDir,
    }));
    expect(mockFormatPrReviewAsTask).toHaveBeenCalledWith(normalizedPrReview);
    expect(taskContent).toMatchObject({
      task: 'formatted PR task with [Image #1]',
      prBranch: 'feature/fix-auth-bug',
      prBaseBranch: 'main',
      attachments: [attachment],
      cleanupAttachments,
    });
  });

  it('should stage PR image attachments into the workflow execution prompt and cleanup transient task specs', async () => {
    const projectDir = createTempProject();
    const attachment = createAttachment(projectDir, 'png-data');
    const cleanupAttachments = vi.fn();
    mockExecuteTask.mockImplementationOnce(async (arg: {
      task: string;
      reportDirName?: string;
    }) => {
      expect(arg.task).toContain('Primary spec:');
      expect(arg.task).toContain('context/task/order.md');
      if (!arg.reportDirName) {
        throw new Error('reportDirName is required for staged PR attachments.');
      }
      const runContextTaskDir = path.join(projectDir, '.takt', 'runs', arg.reportDirName, 'context', 'task');
      expect(fs.readFileSync(path.join(runContextTaskDir, 'order.md'), 'utf-8')).toContain(
        `- [Image #1]: \`.takt/runs/${arg.reportDirName}/context/task/attachments/image-1.png\``,
      );
      expect(fs.readFileSync(path.join(runContextTaskDir, 'attachments', 'image-1.png'), 'utf-8')).toBe('png-data');
      return true;
    });

    const ok = await runWorkflow(
      projectDir,
      'default',
      'Use [Image #1] as reference.',
      projectDir,
      { prNumber: 456 },
      {
        execCwd: projectDir,
        isWorktree: false,
        branch: 'feature/fix-auth-bug',
        baseBranch: 'main',
      },
      {
        attachments: [attachment],
        cleanupAttachments,
      },
    );

    expect(ok).toBe(true);
    expect(mockExecuteTask).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(projectDir, '.takt', 'tasks'))).toBe(false);
    expect(cleanupAttachments).toHaveBeenCalledTimes(1);
  });

  it('should carry PR image attachments through executePipeline --pr to executeTask', async () => {
    const projectDir = createTempProject();
    const attachment = createAttachment(projectDir, 'png-data');
    const cleanupAttachments = vi.fn();
    const prReview = createPrReview({
      body: 'PR description ![screenshot](https://github.com/user-attachments/assets/abc)',
    });
    const normalizedPrReview = createPrReview({
      body: 'PR description [Image #1]',
    });
    mockFetchPrReviewComments.mockReturnValue(prReview);
    mockResolvePrReviewImageAttachments.mockResolvedValue({
      prReview: normalizedPrReview,
      attachments: [attachment],
      cleanupAttachments,
    });
    mockFormatPrReviewAsTask.mockReturnValue('Use [Image #1] as reference.');
    mockExecuteTask.mockImplementationOnce(async (arg: {
      task: string;
      reportDirName?: string;
    }) => {
      expect(arg.task).toContain('Primary spec:');
      expect(arg.task).toContain('context/task/order.md');
      if (!arg.reportDirName) {
        throw new Error('reportDirName is required for staged PR attachments.');
      }
      const runContextTaskDir = path.join(projectDir, '.takt', 'runs', arg.reportDirName, 'context', 'task');
      expect(fs.readFileSync(path.join(runContextTaskDir, 'order.md'), 'utf-8')).toContain('[Image #1]');
      expect(fs.readFileSync(path.join(runContextTaskDir, 'attachments', 'image-1.png'), 'utf-8')).toBe('png-data');
      return true;
    });

    const exitCode = await executePipeline({
      cwd: projectDir,
      workflow: 'default',
      prNumber: 456,
      autoPr: false,
      draftPr: false,
      skipGit: true,
    });

    expect(exitCode).toBe(0);
    expect(mockExecuteTask).toHaveBeenCalledTimes(1);
    expect(cleanupAttachments).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(projectDir, '.takt', 'tasks'))).toBe(false);
  });

  it('should cleanup resolved PR image attachments when PR task formatting throws', async () => {
    const projectDir = createTempProject();
    const attachment = createAttachment(projectDir, 'png-data');
    const cleanupAttachments = vi.fn();
    const prReview = createPrReview({
      body: 'PR description ![screenshot](https://github.com/user-attachments/assets/abc)',
    });
    const normalizedPrReview = createPrReview({
      body: 'PR description [Image #1]',
    });
    mockFetchPrReviewComments.mockReturnValue(prReview);
    mockResolvePrReviewImageAttachments.mockResolvedValue({
      prReview: normalizedPrReview,
      attachments: [attachment],
      cleanupAttachments,
    });
    mockFormatPrReviewAsTask.mockImplementationOnce(() => {
      throw new Error('format failed');
    });

    const taskContent = await resolveTaskContent({
      cwd: projectDir,
      workflow: 'default',
      prNumber: 456,
      autoPr: false,
      draftPr: false,
      skipGit: true,
    });

    expect(taskContent).toBeUndefined();
    expect(cleanupAttachments).toHaveBeenCalledTimes(1);
    expect(mockExecuteTask).not.toHaveBeenCalled();
  });

  it('should return the issue fetch failure exit code when PR image attachment resolution fails', async () => {
    const projectDir = createTempProject();
    const prReview = createPrReview({
      body: 'PR description ![screenshot](https://github.com/user-attachments/assets/abc)',
    });
    mockFetchPrReviewComments.mockReturnValue(prReview);
    mockResolvePrReviewImageAttachments.mockRejectedValueOnce(new Error('download failed'));

    const exitCode = await executePipeline({
      cwd: projectDir,
      workflow: 'default',
      prNumber: 456,
      autoPr: false,
      draftPr: false,
      skipGit: true,
    });

    expect(exitCode).toBe(2);
    expect(mockExecuteTask).not.toHaveBeenCalled();
  });
});
