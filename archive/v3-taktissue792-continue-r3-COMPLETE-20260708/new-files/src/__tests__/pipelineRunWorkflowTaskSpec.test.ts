import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskAttachment } from '../features/tasks/attachments.js';

const { mockExecuteTask } = vi.hoisted(() => ({
  mockExecuteTask: vi.fn(),
}));

vi.mock('../features/tasks/index.js', () => ({
  executeTask: (...args: unknown[]) => mockExecuteTask(...args),
  confirmAndCreateWorktree: vi.fn(),
}));

vi.mock('../shared/ui/index.js', () => ({
  info: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('../shared/ui/StatusLine.js', () => ({
  statusLine: {
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

import { runWorkflow } from '../features/pipeline/steps.js';

const tempRoots = new Set<string>();

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteTask.mockResolvedValue(true);
});

afterEach(() => {
  for (const root of tempRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  tempRoots.clear();
});

function createTempProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'takt-pipeline-run-workflow-test-'));
  tempRoots.add(root);
  return root;
}

function createAttachment(root: string): TaskAttachment {
  const attachmentDir = path.join(root, 'source-attachments');
  const tempPath = path.join(attachmentDir, 'image-1.png');
  fs.mkdirSync(attachmentDir, { recursive: true });
  fs.writeFileSync(tempPath, 'png-data', 'utf-8');
  return {
    placeholder: '[Image #1]',
    tempPath,
    fileName: 'image-1.png',
  };
}

describe('runWorkflow task spec staging', () => {
  it('keeps staged PR attachment task context as a run artifact after execution', async () => {
    const projectCwd = createTempProject();
    const attachment = createAttachment(projectCwd);
    const task = `Use [Image #1] (\`${attachment.tempPath}\`) as evidence.`;

    const succeeded = await runWorkflow(
      projectCwd,
      'default',
      task,
      projectCwd,
      { prNumber: 12 },
      {
        execCwd: projectCwd,
        isWorktree: false,
        branch: 'feature/screenshots',
        baseBranch: 'main',
      },
      [attachment],
    );

    expect(mockExecuteTask).toHaveBeenCalledTimes(1);
    const executeArg = mockExecuteTask.mock.calls[0]?.[0] as {
      reportDirName?: string;
      task?: string;
    };
    expect(succeeded).toBe(true);
    expect(executeArg.reportDirName).toEqual(expect.any(String));
    expect(executeArg.task).toContain(`.takt/runs/${executeArg.reportDirName}/context/task/order.md`);

    const contextTaskDir = path.join(projectCwd, '.takt', 'runs', executeArg.reportDirName!, 'context', 'task');
    const stagedOrderPath = path.join(contextTaskDir, 'order.md');
    const stagedAttachmentPath = path.join(contextTaskDir, 'attachments', 'image-1.png');
    expect(fs.readFileSync(stagedOrderPath, 'utf-8')).toContain(
      `.takt/runs/${executeArg.reportDirName}/context/task/attachments/image-1.png`,
    );
    expect(fs.readFileSync(stagedAttachmentPath, 'utf-8')).toBe('png-data');
    expect(fs.existsSync(path.join(projectCwd, '.takt', 'tasks'))).toBe(false);
  });
});
