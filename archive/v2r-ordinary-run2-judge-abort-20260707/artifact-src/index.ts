/**
 * 公開 API。仕様は README.md、型の契約は ./types.ts を参照。
 * このファイルの公開シグネチャは変更禁止。内部のモジュール分割は自由
 * （実装を別モジュールに置き、ここから re-export してよい）。
 */
import {
  ValidationError,
  NotFoundError,
  InvalidTransitionError,
} from './types.js';
import type {
  Clock,
  CreateTaskInput,
  IdGenerator,
  TaskFilter,
  TaskRecord,
  TaskRepository,
  TaskStatus,
  UpdateTaskInput,
} from './types.js';

export * from './types.js';

import type { Priority } from './types.js';

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function normalizeTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Title is required');
  }
  if (trimmed.length > 200) {
    throw new ValidationError('Title must be at most 200 characters');
  }
  return trimmed;
}

function normalizeDescription(description?: string): string {
  return description?.trim() ?? '';
}

function normalizeAssignee(assignee: string): string {
  const trimmed = assignee.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Assignee is required');
  }
  return trimmed;
}

function normalizeOptionalAssignee(assignee?: string): string | undefined {
  return assignee !== undefined ? normalizeAssignee(assignee) : undefined;
}

function normalizeTags(tags?: string[]): string[] {
  if (tags === undefined || tags.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized.length > 0 && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

function validateDueDate(dueDate?: Date, now?: Date): Date | undefined {
  if (dueDate === undefined) {
    return undefined;
  }
  if (now === undefined) {
    throw new ValidationError('Current time is required for due date validation');
  }
  if (dueDate.getTime() < now.getTime()) {
    throw new ValidationError('Due date cannot be in the past');
  }
  return dueDate;
}

function isActive(status: TaskStatus): boolean {
  return status === 'todo' || status === 'in_progress';
}

function assertActiveForMutation(task: TaskRecord): void {
  if (!isActive(task.status)) {
    throw new InvalidTransitionError(
      `Cannot modify task with status: ${task.status}`,
    );
  }
}

class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  createTask(input: CreateTaskInput): TaskRecord {
    const now = this.clock.now();
    const id = this.idGenerator.next();
    const title = normalizeTitle(input.title);
    const description = normalizeDescription(input.description);
    const priority = input.priority ?? 'medium';
    const assignee = input.assignee ? normalizeAssignee(input.assignee) : undefined;
    const tags = normalizeTags(input.tags);
    const dueDateInput = validateDueDate(input.dueDate, now);

    const dueDate = dueDateInput !== undefined ? new Date(dueDateInput.getTime()) : undefined;

    const task: TaskRecord = {
      id,
      title,
      description,
      priority,
      status: 'todo',
      assignee,
      tags,
      createdAt: now,
      updatedAt: now,
      dueDate,
    };

    this.repo.save(task);
    return task;
  }

  getTask(id: string): TaskRecord {
    const task = this.repo.findById(id);
    if (task === undefined) {
      throw new NotFoundError(`Task not found: ${id}`);
    }
    return task;
  }

  updateTask(id: string, input: UpdateTaskInput): TaskRecord {
    const task = this.repo.findById(id);
    if (task === undefined) {
      throw new NotFoundError(`Task not found: ${id}`);
    }
    assertActiveForMutation(task);

    const now = this.clock.now();
    const title = input.title !== undefined ? normalizeTitle(input.title) : task.title;
    const description =
      input.description !== undefined
        ? normalizeDescription(input.description)
        : task.description;
    const priority = input.priority ?? task.priority;
    const tags =
      input.tags !== undefined ? normalizeTags(input.tags) : task.tags;
    let dueDate: Date | undefined;
    if (input.dueDate === null) {
      dueDate = undefined;
    } else if (input.dueDate instanceof Date) {
      const validated = validateDueDate(input.dueDate, now);
      dueDate = validated !== undefined ? new Date(validated.getTime()) : undefined;
    } else {
      dueDate = task.dueDate;
    }

    const updatedTask: TaskRecord = {
      ...task,
      title,
      description,
      priority,
      tags,
      dueDate,
      createdAt: task.createdAt,
      updatedAt: now,
    };

    this.repo.save(updatedTask);
    return updatedTask;
  }

  changeStatus(id: string, next: TaskStatus): TaskRecord {
    const task = this.repo.findById(id);
    if (task === undefined) {
      throw new NotFoundError(`Task not found: ${id}`);
    }

    const current = task.status;
    const allowedTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
      todo: ['in_progress', 'cancelled'],
      in_progress: ['done', 'todo', 'cancelled'],
      done: [],
      cancelled: [],
    };

    if (!allowedTransitions[current].includes(next)) {
      throw new InvalidTransitionError(
        `Invalid status transition: ${current} -> ${next}`,
      );
    }

    const now = this.clock.now();
    const updatedTask: TaskRecord = {
      ...task,
      status: next,
      updatedAt: now,
    };

    this.repo.save(updatedTask);
    return updatedTask;
  }

  assign(id: string, assignee: string): TaskRecord {
    const task = this.repo.findById(id);
    if (task === undefined) {
      throw new NotFoundError(`Task not found: ${id}`);
    }
    assertActiveForMutation(task);

    const now = this.clock.now();
    const normalizedAssignee = normalizeAssignee(assignee);
    const updatedTask: TaskRecord = {
      ...task,
      assignee: normalizedAssignee,
      updatedAt: now,
    };

    this.repo.save(updatedTask);
    return updatedTask;
  }

  unassign(id: string): TaskRecord {
    const task = this.repo.findById(id);
    if (task === undefined) {
      throw new NotFoundError(`Task not found: ${id}`);
    }
    assertActiveForMutation(task);

    const now = this.clock.now();
    const updatedTask: TaskRecord = {
      ...task,
      assignee: undefined,
      updatedAt: now,
    };

    this.repo.save(updatedTask);
    return updatedTask;
  }

  listTasks(filter?: TaskFilter): TaskRecord[] {
    let tasks = this.repo.all();

    if (filter) {
      if (filter.status !== undefined) {
        tasks = tasks.filter((t) => t.status === filter.status);
      }
      if (filter.assignee !== undefined) {
        tasks = tasks.filter((t) => t.assignee === filter.assignee);
      }
      if (filter.tag !== undefined) {
        const normalizedTag = filter.tag.trim().toLowerCase();
        tasks = tasks.filter((t) => t.tags.includes(normalizedTag));
      }
      if (filter.overdueAsOf !== undefined) {
        const overdueAsOf = filter.overdueAsOf;
        tasks = tasks.filter(
          (t) =>
            t.dueDate !== undefined &&
            t.dueDate.getTime() < overdueAsOf.getTime() &&
            isActive(t.status),
        );
      }
    }

    tasks.sort((a, b) => {
      const priorityDiff = (PRIORITY_RANK as Record<Priority, number>)[a.priority] - (PRIORITY_RANK as Record<Priority, number>)[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      if (a.dueDate !== undefined && b.dueDate !== undefined) {
        const dueDiff = a.dueDate.getTime() - b.dueDate.getTime();
        if (dueDiff !== 0) {
          return dueDiff;
        }
      } else if (a.dueDate !== undefined) {
        return -1;
      } else if (b.dueDate !== undefined) {
        return 1;
      }

      const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdDiff !== 0) {
        return createdDiff;
      }

      return a.id.localeCompare(b.id);
    });

    return tasks;
  }
}

export { TaskService };
