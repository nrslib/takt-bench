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
  ValidationError,
  NotFoundError,
  InvalidTransitionError,
} from './types.js';

export * from './types.js';

export class InMemoryTaskRepository implements TaskRepository {
  private tasks: Map<string, TaskRecord> = new Map();

  save(task: TaskRecord): void {
    const cloned = this.cloneTask(task);
    this.tasks.set(task.id, cloned);
  }

  findById(id: string): TaskRecord | undefined {
    const task = this.tasks.get(id);
    if (task === undefined) {
      return undefined;
    }
    return this.cloneTask(task);
  }

  delete(id: string): boolean {
    return this.tasks.delete(id);
  }

  all(): TaskRecord[] {
    const result: TaskRecord[] = [];
    for (const task of this.tasks.values()) {
      result.push(this.cloneTask(task));
    }
    return result;
  }

  private cloneTask(task: TaskRecord): TaskRecord {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      assignee: task.assignee,
      tags: [...task.tags],
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
    const title = this.trimAndValidateTitle(input.title);
    const assignee = this.validateAssignee(input.assignee);
    const dueDate = this.validateDueDate(input.dueDate, now);
    const description = this.normalizeDescription(input.description);
    const id = this.idGenerator.next();
    const task: TaskRecord = {
      id,
      title,
      description,
      priority: input.priority ?? 'medium',
      status: 'todo',
      assignee,
      tags: this.normalizeTags(input.tags),
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
      throw new NotFoundError('タスクが見つかりません');
    }
    return task;
  }

  updateTask(id: string, input: UpdateTaskInput): TaskRecord {
    const existing = this.repo.findById(id);
    if (existing === undefined) {
      throw new NotFoundError('タスクが見つかりません');
    }
    this.validateUpdateTransition(existing.status);
    const now = this.clock.now();
    const task: TaskRecord = {
      ...existing,
      title: input.title !== undefined ? this.trimAndValidateTitle(input.title) : existing.title,
      description: input.description !== undefined ? this.normalizeDescription(input.description) : existing.description,
      priority: input.priority ?? existing.priority,
      tags: input.tags !== undefined ? this.normalizeTags(input.tags) : existing.tags,
      status: existing.status,
      assignee: existing.assignee,
      createdAt: existing.createdAt,
      updatedAt: now,
      dueDate: this.updateDueDate(existing.dueDate, input.dueDate),
    };
    this.repo.save(task);
    return task;
  }

  changeStatus(id: string, next: TaskStatus): TaskRecord {
    const existing = this.repo.findById(id);
    if (existing === undefined) {
      throw new NotFoundError('タスクが見つかりません');
    }
    this.validateStatusTransition(existing.status, next);
    const now = this.clock.now();
    const task: TaskRecord = {
      ...existing,
      status: next,
      updatedAt: now,
    };
    this.repo.save(task);
    return task;
  }

  assign(id: string, assignee: string): TaskRecord {
    const existing = this.repo.findById(id);
    if (existing === undefined) {
      throw new NotFoundError('タスクが見つかりません');
    }
    this.validateMutableStatus(existing.status);
    const trimmed = this.validateAssignee(assignee);
    const now = this.clock.now();
    const task: TaskRecord = {
      ...existing,
      assignee: trimmed,
      updatedAt: now,
    };
    this.repo.save(task);
    return task;
  }

  unassign(id: string): TaskRecord {
    const existing = this.repo.findById(id);
    if (existing === undefined) {
      throw new NotFoundError('タスクが見つかりません');
    }
    this.validateMutableStatus(existing.status);
    const now = this.clock.now();
    const task: TaskRecord = {
      ...existing,
      assignee: undefined,
      updatedAt: now,
    };
    this.repo.save(task);
    return task;
  }

  listTasks(filter?: TaskFilter): TaskRecord[] {
    const all = this.repo.all();
    let result = all.filter((task) => {
      if (filter?.status !== undefined && task.status !== filter.status) {
        return false;
      }
      if (filter?.assignee !== undefined && task.assignee !== filter.assignee) {
        return false;
      }
      if (filter?.tag !== undefined && !task.tags.includes(filter.tag.trim().toLowerCase())) {
        return false;
      }
      if (filter?.overdueAsOf !== undefined) {
        if (task.dueDate === undefined) {
          return false;
        }
        if (task.dueDate >= filter.overdueAsOf) {
          return false;
        }
        if (task.status === 'done' || task.status === 'cancelled') {
          return false;
        }
      }
      return true;
    });
    result.sort((a, b) => {
      const priorityDiff = this.priorityOrder(b.priority) - this.priorityOrder(a.priority);
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
      const createdAtDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }
      return a.id.localeCompare(b.id);
    });
    return result;
  }

  private trimAndValidateTitle(title: string): string {
    const trimmed = title.trim();
    if (trimmed === '') {
      throw new ValidationError('タイトルは空白にできません');
    }
    if (trimmed.length > 200) {
      throw new ValidationError('タイトルは200文字以内でなければなりません');
    }
    return trimmed;
  }

  private validateDueDate(dueDate: Date | undefined, now: Date): Date | undefined {
    if (dueDate === undefined) {
      return undefined;
    }
    if (dueDate < now) {
      throw new ValidationError('期限は現在時刻より後でなければなりません');
    }
    return dueDate;
  }

  private validateAssignee(assignee: string | undefined): string | undefined {
    if (assignee === undefined) {
      return undefined;
    }
    const trimmed = assignee.trim();
    if (trimmed === '') {
      throw new ValidationError('担当者は空白にできません');
    }
    return trimmed;
  }

  private normalizeDescription(description: string | undefined): string {
    return description?.trim() ?? '';
  }

  private normalizeTags(tags: string[] | undefined): string[] {
    if (tags === undefined) {
      return [];
    }
    const seen = new Set<string>();
    const result: string[] = [];
    for (const tag of tags) {
      const normalized = tag.trim().toLowerCase();
      if (normalized === '') {
        continue;
      }
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(normalized);
    }
    return result;
  }

  private updateDueDate(current: Date | undefined, input: Date | null | undefined): Date | undefined {
    if (input === undefined) {
      return current;
    }
    if (input === null) {
      return undefined;
    }
    const now = this.clock.now();
    return this.validateDueDate(input, now);
  }

  private validateUpdateTransition(status: TaskStatus): void {
    if (status === 'done' || status === 'cancelled') {
      throw new InvalidTransitionError('完了またはキャンセルされたタスクは更新できません');
    }
  }

  private validateStatusTransition(current: TaskStatus, next: TaskStatus): void {
    const allowed = [
      ['todo', 'in_progress'],
      ['todo', 'cancelled'],
      ['in_progress', 'done'],
      ['in_progress', 'todo'],
      ['in_progress', 'cancelled'],
    ];
    const isValid = allowed.some(([from, to]) => from === current && to === next);
    if (!isValid) {
      throw new InvalidTransitionError(`状態を ${current} から ${next} への遷移は許可されていません`);
    }
  }

  private validateMutableStatus(status: TaskStatus): void {
    if (status === 'done' || status === 'cancelled') {
      throw new InvalidTransitionError('完了またはキャンセルされたタスクには担当者を設定できません');
    }
  }

  private priorityOrder(priority: Priority): number {
    if (priority === 'high') {
      return 3;
    }
    if (priority === 'medium') {
      return 2;
    }
    return 1;
  }
}
