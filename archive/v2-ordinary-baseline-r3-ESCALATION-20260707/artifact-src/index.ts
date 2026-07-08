/**
 * 公開 API。仕様は README.md、型の契約は ./types.ts を参照。
 * このファイルの公開シグネチャは変更禁止。内部のモジュール分割は自由
 * （実装を別モジュールに置き、ここから re-export してよい）。
 */
import type {
  Clock,
  CreateTaskInput,
  IdGenerator,
  Priority,
  TaskFilter,
  TaskRecord,
  TaskRepository,
  TaskStatus,
  UpdateTaskInput,
} from './types.js';
import {
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from './types.js';

const MIN_PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks: Map<string, TaskRecord> = new Map();

  save(task: TaskRecord): void {
    this.tasks.set(task.id, this.deepClone(task));
  }

  findById(id: string): TaskRecord | undefined {
    const task = this.tasks.get(id);
    if (!task) {
      return undefined;
    }
    return this.deepClone(task);
  }

  delete(id: string): boolean {
    return this.tasks.delete(id);
  }

  all(): TaskRecord[] {
    const result: TaskRecord[] = [];
    for (const task of this.tasks.values()) {
      result.push(this.deepClone(task));
    }
    return result;
  }

  private deepClone(task: TaskRecord): TaskRecord {
    return {
      ...task,
      tags: [...task.tags] as string[],
      createdAt: new Date(task.createdAt.getTime()),
      updatedAt: new Date(task.updatedAt.getTime()),
      dueDate: task.dueDate ? new Date(task.dueDate.getTime()) : undefined,
    };
  }
}

export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  createTask(input: CreateTaskInput): TaskRecord {
    const now = this.clock.now();
    const normalized = this.validateCommonTaskInput(input, 'create');
    const id = this.idGenerator.next();

    const task: TaskRecord = {
      id,
      title: normalized.title!,
      description: normalized.description!,
      priority: normalized.priority!,
      status: 'todo',
      assignee: normalized.assignee!,
      tags: normalized.tags,
      createdAt: now,
      updatedAt: now,
      dueDate: normalized.dueDate,
    };

    this.repo.save(task);
    return this.repo.findById(id)!;
  }

  getTask(id: string): TaskRecord {
    const task = this.repo.findById(id);
    if (!task) {
      throw new NotFoundError(`Task not found: ${id}`);
    }
    return task;
  }

  updateTask(id: string, input: UpdateTaskInput): TaskRecord {
    const task = this.getTask(id);
    const now = this.clock.now();

    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw new InvalidTransitionError(
        `Cannot update task in status: ${task.status}`,
      );
    }

    const normalized = this.validateCommonTaskInput(input, 'update');

    const updated: TaskRecord = {
      ...task,
      title: normalized.title ?? task.title,
      description: normalized.description ?? task.description,
      priority: normalized.priority ?? task.priority,
      tags: normalized.tags ?? task.tags,
      assignee: normalized.assignee ?? task.assignee,
      dueDate: input.dueDate === undefined ? task.dueDate : (normalized.dueDate as Date | undefined),
      updatedAt: now,
    };

    this.repo.save(updated);
    return this.repo.findById(id)!;
  }

  changeStatus(id: string, next: TaskStatus): TaskRecord {
    const task = this.getTask(id);
    const now = this.clock.now();

    const allowed = this.getAllowedTransitions(task.status);
    if (!allowed.includes(next)) {
      throw new InvalidTransitionError(
        `Invalid transition: ${task.status} -> ${next}`,
      );
    }

    const updated: TaskRecord = {
      ...task,
      status: next,
      updatedAt: now,
    };

    this.repo.save(updated);
    return this.repo.findById(id)!;
  }

  assign(id: string, assignee: string): TaskRecord {
    const task = this.getTask(id);
    const now = this.clock.now();

    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw new InvalidTransitionError(
        `Cannot assign task in status: ${task.status}`,
      );
    }

    const trimmed = assignee.trim();
    if (trimmed === '') {
      throw new ValidationError('Assignee must not be empty');
    }

    const updated: TaskRecord = {
      ...task,
      assignee: trimmed,
      updatedAt: now,
    };

    this.repo.save(updated);
    return this.repo.findById(id)!;
  }

  unassign(id: string): TaskRecord {
    const task = this.getTask(id);
    const now = this.clock.now();

    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw new InvalidTransitionError(
        `Cannot unassign task in status: ${task.status}`,
      );
    }

    const updated: TaskRecord = {
      ...task,
      assignee: undefined,
      updatedAt: now,
    };

    this.repo.save(updated);
    return this.repo.findById(id)!;
  }

  listTasks(filter?: TaskFilter): TaskRecord[] {
    const all = this.repo.all();
    const now = this.clock.now();

    let result = all.filter((task) => {
      if (filter?.status && task.status !== filter.status) {
        return false;
      }
      if (filter?.assignee && task.assignee !== filter.assignee) {
        return false;
      }
      if (filter?.tag) {
        const normalizedTag = filter.tag.trim().toLowerCase();
        if (!task.tags.includes(normalizedTag)) {
          return false;
        }
      }
      if (filter?.overdueAsOf) {
        if (
          task.dueDate &&
          task.dueDate < filter.overdueAsOf &&
          (task.status === 'todo' || task.status === 'in_progress')
        ) {
          return true;
        }
        return false;
      }
      return true;
    });

    result.sort((a, b) => {
      const priorityDiff =
        MIN_PRIORITY_ORDER[a.priority] - MIN_PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      if (a.dueDate && b.dueDate) {
        const dueDiff = a.dueDate.getTime() - b.dueDate.getTime();
        if (dueDiff !== 0) {
          return dueDiff;
        }
      } else if (a.dueDate && !b.dueDate) {
        return -1;
      } else if (!a.dueDate && b.dueDate) {
        return 1;
      }

      const createdAtDiff =
        a.createdAt.getTime() - b.createdAt.getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return a.id.localeCompare(b.id);
    });

    return result;
  }

  private getAllowedTransitions(current: TaskStatus): TaskStatus[] {
    switch (current) {
      case 'todo':
        return ['in_progress', 'cancelled'];
      case 'in_progress':
        return ['done', 'todo', 'cancelled'];
      case 'done':
      case 'cancelled':
        return [];
    }
  }

  private validateCommonTaskInput(
    input: CreateTaskInput | UpdateTaskInput,
    mode: 'create' | 'update',
  ): {
    title?: string;
    description?: string;
    priority?: Priority;
    assignee?: string;
    tags: string[];
    dueDate?: Date | undefined;
  } {
    const now = this.clock.now();

    if (mode === 'create') {
      const createInput = input as CreateTaskInput;
      if (createInput.title.trim() === '') {
        throw new ValidationError('Title must not be empty');
      }
      if (createInput.title.trim().length > 200) {
        throw new ValidationError('Title must be at most 200 characters');
      }
    } else {
      const updateInput = input as UpdateTaskInput;
      if (updateInput.title !== undefined) {
        if (updateInput.title.trim() === '') {
          throw new ValidationError('Title must not be empty');
        }
        if (updateInput.title.trim().length > 200) {
          throw new ValidationError('Title must be at most 200 characters');
        }
      }
    }

    let dueDate: Date | undefined;
    if (mode === 'create') {
      const createInput = input as CreateTaskInput;
      if (createInput.dueDate !== undefined) {
        if (createInput.dueDate < now) {
          throw new ValidationError('Due date must not be in the past');
        }
        dueDate = new Date(createInput.dueDate.getTime());
      }
    } else {
      const updateInput = input as UpdateTaskInput;
      if (updateInput.dueDate !== undefined) {
        if (updateInput.dueDate !== null) {
          if (updateInput.dueDate < now) {
            throw new ValidationError('Due date must not be in the past');
          }
          dueDate = new Date(updateInput.dueDate.getTime());
        }
      }
    }

    let assignee: string | undefined;
    const assigneeInput = (input as CreateTaskInput | UpdateTaskInput).assignee;
    if (assigneeInput !== undefined) {
      const trimmed = (assigneeInput as string).trim();
      if (trimmed === '') {
        throw new ValidationError('Assignee must not be empty');
      }
      assignee = trimmed;
    }

    let tags: string[] = [];
    const tagsInput = (input as CreateTaskInput | UpdateTaskInput).tags;
    if (tagsInput !== undefined) {
      const seen = new Set<string>();
      tags = [...(tagsInput as string[])].map((tag) => tag.trim().toLowerCase()).filter((tag) => {
        if (tag === '') {
          return false;
        }
        if (seen.has(tag)) {
          return false;
        }
        seen.add(tag);
        return true;
      });
    }

    return {
      title: mode === 'create' ? (input as CreateTaskInput).title?.trim() : (input as UpdateTaskInput).title?.trim(),
      description: mode === 'create' ? ((input as CreateTaskInput).description?.trim() ?? '') : (input as UpdateTaskInput).description?.trim(),
      priority: mode === 'create' ? ((input as CreateTaskInput).priority ?? 'medium') : (input as UpdateTaskInput).priority,
      assignee,
      tags,
      dueDate,
    };
  }
}
