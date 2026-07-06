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
import * as Validation from './task-validation.js';
import { NotFoundError, InvalidTransitionError } from './types.js';
import { copyTaskRecord } from './task-copy.js';

export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  createTask(input: CreateTaskInput): TaskRecord {
    const now = this.clock.now();
    const normalized = Validation.normalizeCreateTaskInput(input, now);
    const id = this.idGenerator.next();

    const task: TaskRecord = {
      id,
      title: normalized.title,
      description: normalized.description,
      priority: normalized.priority,
      status: 'todo',
      assignee: normalized.assignee,
      tags: normalized.tags,
      createdAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime()),
      dueDate: normalized.dueDate,
    };

    this.repo.save(task);
    return copyTaskRecord(task);
  }

  getTask(id: string): TaskRecord {
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`Task with id "${id}" not found`);
    }
    return task;
  }

  updateTask(id: string, input: UpdateTaskInput): TaskRecord {
    const now = this.clock.now();
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`Task with id "${id}" not found`);
    }

    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw new InvalidTransitionError(
        `Cannot update task with status "${task.status}". Only "todo" and "in_progress" are allowed.`,
      );
    }

    const normalized = Validation.normalizeUpdateTaskInput(input, now);

    const updated: TaskRecord = {
      ...task,
      ...normalized,
      updatedAt: new Date(now.getTime()),
    };

    this.repo.save(updated);
    return copyTaskRecord(updated);
  }

  changeStatus(id: string, next: TaskStatus): TaskRecord {
    const now = this.clock.now();
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`Task with id "${id}" not found`);
    }

    if (!Validation.isValidTransition(task.status, next)) {
      throw new InvalidTransitionError(
        `Invalid transition from "${task.status}" to "${next}"`,
      );
    }

    const updated: TaskRecord = {
      ...task,
      status: next,
      updatedAt: new Date(now.getTime()),
    };

    this.repo.save(updated);
    return copyTaskRecord(updated);
  }

  assign(id: string, assignee: string): TaskRecord {
    const now = this.clock.now();
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`Task with id "${id}" not found`);
    }

    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw new InvalidTransitionError(
        `Cannot assign task with status "${task.status}". Only "todo" and "in_progress" are allowed.`,
      );
    }

    const normalizedAssignee = Validation.normalizeAssignee(assignee);

    const updated: TaskRecord = {
      ...task,
      assignee: normalizedAssignee,
      updatedAt: new Date(now.getTime()),
    };

    this.repo.save(updated);
    return copyTaskRecord(updated);
  }

  unassign(id: string): TaskRecord {
    const now = this.clock.now();
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`Task with id "${id}" not found`);
    }

    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw new InvalidTransitionError(
        `Cannot unassign task with status "${task.status}". Only "todo" and "in_progress" are allowed.`,
      );
    }

    const updated: TaskRecord = {
      ...task,
      assignee: undefined,
      updatedAt: new Date(now.getTime()),
    };

    this.repo.save(updated);
    return copyTaskRecord(updated);
  }

  listTasks(filter?: TaskFilter): TaskRecord[] {
    const all = this.repo.all();
    let result = all;

    if (filter) {
      if (filter.status !== undefined) {
        result = result.filter((t) => t.status === filter.status);
      }
      if (filter.assignee !== undefined) {
        result = result.filter((t) => t.assignee === filter.assignee);
      }
      if (filter.tag !== undefined) {
        const normalizedTag = filter.tag.trim().toLowerCase();
        result = result.filter((t) => t.tags.includes(normalizedTag));
      }
      if (filter.overdueAsOf !== undefined) {
        const now = filter.overdueAsOf;
        result = result.filter(
          (t) =>
            t.dueDate !== undefined &&
            t.dueDate.getTime() < now.getTime() &&
            (t.status === 'todo' || t.status === 'in_progress'),
        );
      }
    }

    const priorityOrder = { high: 0, medium: 1, low: 2 };

    result.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      const dueA = a.dueDate?.getTime();
      const dueB = b.dueDate?.getTime();
      if (dueA !== undefined && dueB !== undefined) {
        const dueDiff = dueA - dueB;
        if (dueDiff !== 0) return dueDiff;
      } else if (dueA !== undefined) {
        return -1;
      } else if (dueB !== undefined) {
        return 1;
      }

      const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdDiff !== 0) return createdDiff;

      return a.id.localeCompare(b.id);
    });

    return result;
  }
}
