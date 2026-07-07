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
import { ValidationError, NotFoundError, InvalidTransitionError } from './types.js';
import { cloneTaskRecord } from './task-record.js';
import { normalizeCreateInput, normalizeUpdateInput } from './validator.js';

export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  createTask(input: CreateTaskInput): TaskRecord {
    const now = this.clock.now();
    const normalized = normalizeCreateInput(input, now);

    const task: TaskRecord = {
      id: this.idGenerator.next(),
      title: normalized.title,
      description: normalized.description,
      priority: normalized.priority,
      status: 'todo',
      assignee: normalized.assignee,
      tags: normalized.tags,
      createdAt: now,
      updatedAt: now,
      dueDate: normalized.dueDate,
    };

    this.repo.save(task);
    return cloneTaskRecord(task);
  }

  getTask(id: string): TaskRecord {
    const found = this.repo.findById(id);
    if (found === undefined) {
      throw new NotFoundError(`Task not found: ${id}`);
    }
    return found;
  }

  updateTask(id: string, input: UpdateTaskInput): TaskRecord {
    const existing = this.repo.findById(id);
    if (existing === undefined) {
      throw new NotFoundError(`Task not found: ${id}`);
    }

    if (existing.status !== 'todo' && existing.status !== 'in_progress') {
      throw new InvalidTransitionError(
        `Cannot update task with status: ${existing.status}`,
      );
    }

    const now = this.clock.now();
    const normalized = normalizeUpdateInput(input, now);

    const updated: TaskRecord = {
      ...existing,
      title: normalized.title ?? existing.title,
      description: normalized.description ?? existing.description,
      priority: normalized.priority ?? existing.priority,
      tags: normalized.tags ?? existing.tags,
      updatedAt: now,
    };

    if (normalized.dueDate !== undefined) {
      updated.dueDate = normalized.dueDate;
    }

    this.repo.save(updated);
    return cloneTaskRecord(updated);
  }

  changeStatus(id: string, next: TaskStatus): TaskRecord {
    const existing = this.repo.findById(id);
    if (existing === undefined) {
      throw new NotFoundError(`Task not found: ${id}`);
    }

    if (!this.isAllowedTransition(existing.status, next)) {
      throw new InvalidTransitionError(
        `Invalid transition: ${existing.status} → ${next}`,
      );
    }

    const now = this.clock.now();
    const updated: TaskRecord = {
      ...existing,
      status: next,
      updatedAt: now,
    };

    this.repo.save(updated);
    return cloneTaskRecord(updated);
  }

  assign(id: string, assignee: string): TaskRecord {
    const existing = this.repo.findById(id);
    if (existing === undefined) {
      throw new NotFoundError(`Task not found: ${id}`);
    }

    if (existing.status !== 'todo' && existing.status !== 'in_progress') {
      throw new InvalidTransitionError(
        `Cannot assign task with status: ${existing.status}`,
      );
    }

    const normalizedAssignee = assignee.trim();
    if (normalizedAssignee === '') {
      throw new ValidationError('assignee must not be empty');
    }

    const now = this.clock.now();
    const updated: TaskRecord = {
      ...existing,
      assignee: normalizedAssignee,
      updatedAt: now,
    };

    this.repo.save(updated);
    return cloneTaskRecord(updated);
  }

  unassign(id: string): TaskRecord {
    const existing = this.repo.findById(id);
    if (existing === undefined) {
      throw new NotFoundError(`Task not found: ${id}`);
    }

    if (existing.status !== 'todo' && existing.status !== 'in_progress') {
      throw new InvalidTransitionError(
        `Cannot unassign task with status: ${existing.status}`,
      );
    }

    const now = this.clock.now();
    const updated: TaskRecord = {
      ...existing,
      assignee: undefined,
      updatedAt: now,
    };

    this.repo.save(updated);
    return cloneTaskRecord(updated);
  }

  listTasks(filter?: TaskFilter): TaskRecord[] {
    let tasks = this.repo.all();

    if (filter !== undefined) {
      if (filter.status !== undefined) {
        tasks = tasks.filter((t) => t.status === filter.status);
      }
      if (filter.assignee !== undefined) {
        tasks = tasks.filter((t) => t.assignee === filter.assignee);
      }
      if (filter.tag !== undefined) {
        const normalizedFilterTag = filter.tag.trim().toLowerCase();
        tasks = tasks.filter((t) =>
          t.tags.some((tag) => tag === normalizedFilterTag),
        );
      }
      if (filter.overdueAsOf !== undefined) {
        tasks = tasks.filter((t) =>
          this.isOverdue(t, filter.overdueAsOf!),
        );
      }
    }

    tasks.sort((a, b) => this.compareTasks(a, b));

    return tasks;
  }



  private isOverdue(task: TaskRecord, overdueAsOf: Date): boolean {
    if (task.dueDate === undefined || task.dueDate === null) {
      return false;
    }
    if (task.status !== 'todo' && task.status !== 'in_progress') {
      return false;
    }
    return task.dueDate < overdueAsOf;
  }

  private isAllowedTransition(from: TaskStatus, to: TaskStatus): boolean {
    const allowed = [
      ['todo', 'in_progress'],
      ['todo', 'cancelled'],
      ['in_progress', 'done'],
      ['in_progress', 'todo'],
      ['in_progress', 'cancelled'],
    ];

    return allowed.some(([f, t]) => f === from && t === to);
  }

  private compareTasks(a: TaskRecord, b: TaskRecord): number {
    const priorityRank = { high: 0, medium: 1, low: 2 };
    const priorityDiff =
      priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const aDueIsMissing =
      a.dueDate === null || a.dueDate === undefined;
    const bDueIsMissing =
      b.dueDate === null || b.dueDate === undefined;

    if (aDueIsMissing && bDueIsMissing) {
      const createdAtDiff =
        a.createdAt.getTime() - b.createdAt.getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }
      return a.id.localeCompare(b.id);
    } else if (aDueIsMissing) {
      return 1;
    } else if (bDueIsMissing) {
      return -1;
    } else {
      const dueDateDiff =
        a.dueDate!.getTime() - b.dueDate!.getTime();
      if (dueDateDiff !== 0) {
        return dueDateDiff;
      }
      const createdAtDiff =
        a.createdAt.getTime() - b.createdAt.getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }
      return a.id.localeCompare(b.id);
    }
  }
}
