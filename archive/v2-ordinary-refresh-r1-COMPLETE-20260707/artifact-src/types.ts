/**
 * 公開契約（変更禁止）。
 * すべての公開型・エラーはここで定義し、実装はこの契約に従う。
 */

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export type Priority = 'low' | 'medium' | 'high';

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  assignee: string | undefined;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date | null | undefined;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: Priority;
  assignee?: string;
  tags?: string[];
  dueDate?: Date | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: Priority;
  tags?: string[];
  /** Date で更新、null で期限を解除、undefined は変更なし */
  dueDate?: Date | null;
}

export interface TaskFilter {
  status?: TaskStatus;
  assignee?: string;
  tag?: string;
  /** この時刻を基準に期限切れ（アクティブかつ dueDate < 基準）だけを返す */
  overdueAsOf?: Date;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export interface TaskRepository {
  save(task: TaskRecord): void;
  findById(id: string): TaskRecord | undefined;
  delete(id: string): boolean;
  all(): TaskRecord[];
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}
