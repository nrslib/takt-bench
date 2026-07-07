/**
 * バリデーション・正規化・コピー関数の集約。
 * createTask/updateTask/assign/listTasks で共通して使うロジックを1箇所に集める。
 * README.md:68「検証ロジックは一箇所に集約し、create / update で重複実装しない」に従う。
 */

import type { Clock, CreateTaskInput, Priority, TaskRecord, UpdateTaskInput } from './types.js';
import { ValidationError, NotFoundError, InvalidTransitionError } from './types.js';

export { ValidationError, NotFoundError, InvalidTransitionError } from './types.js';

/**
 * title を trim して返す。
 * 空文字列または 201 文字以上なら ValidationError を throw。
 */
export function normalizeTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Title is empty after trimming');
  }
  if (trimmed.length > 200) {
    throw new ValidationError(`Title is too long: ${trimmed.length} characters (max: 200)`);
  }
  return trimmed;
}

/**
 * description を trim して返す。
 * 未指定なら空文字列。
 */
export function normalizeDescription(
  description: string | undefined,
): string {
  return description?.trim() ?? '';
}

/**
 * assignee を trim して返す。
 * 未指定なら undefined。
 * 空文字列なら ValidationError を throw。
 */
export function normalizeAssignee(
  assignee: string | undefined,
): string | undefined {
  if (assignee === undefined) {
    return undefined;
  }
  const trimmed = assignee.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Assignee is empty after trimming');
  }
  return trimmed;
}

/**
 * assignee を trim して返す。
 * 必須引数なので、空文字列なら ValidationError を throw。
 */
export function normalizeRequiredAssignee(assignee: string): string {
  const trimmed = assignee.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Assignee is empty after trimming');
  }
  return trimmed;
}

/**
 * tags を trim → 小文字化 → 空削除 → 重複除去（順序保持）して返す。
 */
export function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized.length === 0) {
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

/**
 * tag フィルタ値を trim → 小文字化して返す。
 * 未指定なら undefined。
 */
export function normalizeTagFilter(tag: string | undefined): string | undefined {
  if (!tag) {
    return undefined;
  }
  const trimmed = tag.trim().toLowerCase();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * dueDate を検証して返す。
 * undefined なら undefined。
 * Date または null を渡すと、Date の場合は現在時刻より過去なら ValidationError を throw。
 * null が渡されたら undefined として扱う（error path では使わない想定）。
 * それ以外は dueDate を返す（現在時刻ちょうどは許可）。
 */
export function validateDueDate(
  dueDate: Date | null | undefined,
  now: Date,
): Date | undefined {
  if (!dueDate) {
    return undefined;
  }
  if (dueDate.getTime() < now.getTime()) {
    throw new ValidationError('dueDate is in the past');
  }
  return dueDate;
}

/**
 * Priority のデフォルト値を返す（medium）。
 * priority が undefined ならデフォルト、それ以外はそのまま返す。
 */
export function normalizePriority(
  priority: Priority | undefined,
): Priority {
  return priority ?? 'medium';
}

/**
 * TaskRecord を deep copy して返す。
 * Date と tags 配列もコピーし、参照共有を避ける。
 */
export function cloneTask(task: TaskRecord): TaskRecord {
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

/**
 * Date をコピーして返す。
 * undefined なら undefined を返す。
 */
export function cloneDate(date: Date | undefined): Date | undefined {
  return date ? new Date(date.getTime()) : undefined;
}

/**
 * CreateTaskInput を検証・正規化して TaskRecord を構築する。
 * clock.now() を1回だけ呼び、createdAt/updatedAt に同じ時刻を設定する。
 * idGenerator.next() を呼び、id を生成する。
 * 内部で validateDueDate を使い、clock.now() を渡す。
 */
export function buildTaskRecord(
  input: CreateTaskInput,
  clock: Clock,
  idGenerator: { next(): string },
): TaskRecord {
  const now = clock.now();
  const title = normalizeTitle(input.title);
  const description = normalizeDescription(input.description);
  const priority = normalizePriority(input.priority);
  const assignee = normalizeAssignee(input.assignee);
  const tags = normalizeTags(input.tags);
  const dueDate = validateDueDate(input.dueDate, now);

  return {
    id: idGenerator.next(),
    title,
    description,
    priority,
    status: 'todo',
    assignee,
    tags,
    createdAt: new Date(now.getTime()),
    updatedAt: new Date(now.getTime()),
    dueDate,
  };
}

/**
 * UpdateTaskInput を適用して既存タスクを更新する。
 * dueDate は Date/null/undefined の仕様通り扱う。
 * id/status/createdAt は維持し、updatedAt を更新する。
 * 内部で validateDueDate を使わない（createTask との重複排除のため）。
 */
export function applyUpdateInput(
  existing: TaskRecord,
  input: UpdateTaskInput,
  now: Date,
  validateDueDateImpl: (dueDate: Date | null | undefined) => Date | undefined,
): TaskRecord {
  const title = input.title !== undefined ? normalizeTitle(input.title) : existing.title;
  const description = input.description !== undefined
    ? normalizeDescription(input.description)
    : existing.description;
  const priority = input.priority !== undefined
    ? normalizePriority(input.priority)
    : existing.priority;
  const tags = input.tags !== undefined ? normalizeTags(input.tags) : existing.tags;
  const dueDate =
    input.dueDate !== undefined
      ? validateDueDateImpl(input.dueDate)
      : existing.dueDate;

  return {
    ...existing,
    title,
    description,
    priority,
    tags,
    dueDate,
    updatedAt: new Date(now.getTime()),
  };
}
