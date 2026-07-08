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
  buildTaskRecord,
  cloneRequiredDate,
  cloneTask,
  normalizeTagFilter,
  normalizeRequiredAssignee,
  validateDueDate,
  applyUpdateInput,
} from './validation.js';
import { NotFoundError, InvalidTransitionError } from './types.js';

export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  createTask(input: CreateTaskInput): TaskRecord {
    const task = buildTaskRecord(input, this.clock, this.idGenerator);
    this.repo.save(task);
    return cloneTask(task);
  }

  getTask(id: string): TaskRecord {
    const found = this.repo.findById(id);
    if (!found) {
      throw new NotFoundError(`Task with id ${id} not found`);
    }
    return cloneTask(found);
  }

  updateTask(id: string, input: UpdateTaskInput): TaskRecord {
    const existing = this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError(`Task with id ${id} not found`);
    }
    this.ensureActive(existing);

    const now = this.clock.now();
    const updated = applyUpdateInput(
      existing,
      input,
      now,
      (dueDate) => validateDueDate(dueDate, now),
    );
    this.repo.save(updated);
    return cloneTask(updated);
  }

  changeStatus(id: string, next: TaskStatus): TaskRecord {
    const existing = this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError(`Task with id ${id} not found`);
    }
    this.ensureActive(existing);

    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      todo: ['in_progress', 'cancelled'],
      in_progress: ['done', 'todo', 'cancelled'],
      done: [],
      cancelled: [],
    };

    const allowed = validTransitions[existing.status];
    if (!allowed.includes(next)) {
      throw new InvalidTransitionError(
        `Invalid transition: ${existing.status} -> ${next}`,
      );
    }

    const now = this.clock.now();
    const updated: TaskRecord = {
      ...existing,
      status: next,
      updatedAt: cloneRequiredDate(now),
    };
    this.repo.save(updated);
    return cloneTask(updated);
  }

  assign(id: string, assignee: string): TaskRecord {
    const existing = this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError(`Task with id ${id} not found`);
    }
    this.ensureActive(existing);

    const now = this.clock.now();
    const updated: TaskRecord = {
      ...existing,
      assignee: normalizeRequiredAssignee(assignee),
      updatedAt: cloneRequiredDate(now),
    };
    this.repo.save(updated);
    return cloneTask(updated);
  }

  unassign(id: string): TaskRecord {
    const existing = this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError(`Task with id ${id} not found`);
    }
    this.ensureActive(existing);

    const now = this.clock.now();
    const updated: TaskRecord = {
      ...existing,
      assignee: undefined,
      updatedAt: cloneRequiredDate(now),
    };
    this.repo.save(updated);
    return cloneTask(updated);
  }

  listTasks(filter?: TaskFilter): TaskRecord[] {
    const raw = this.repo.all();
    const statusFilter = filter?.status;
    const assigneeFilter = filter?.assignee;
    const tagFilter = normalizeTagFilter(filter?.tag);
    const overdueAsOf = filter?.overdueAsOf;

    let result = raw.filter((task) => {
      if (statusFilter !== undefined && task.status !== statusFilter) {
        return false;
      }
      if (assigneeFilter !== undefined && task.assignee !== assigneeFilter) {
        return false;
      }

      if (tagFilter !== undefined && !task.tags.includes(tagFilter)) {
        return false;
      }
      if (overdueAsOf !== undefined) {
        if (
          task.dueDate === undefined ||
          task.status !== 'todo' &&
          task.status !== 'in_progress'
        ) {
          return false;
        }
        if (task.dueDate.getTime() >= overdueAsOf.getTime()) {
          return false;
        }
      }
      return true;
    });

    const priorityRank: Record<Priority, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    result.sort((a, b) => {
      const priorityDiff =
        priorityRank[a.priority] - priorityRank[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const aDue = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) {
        return aDue - bDue;
      }

      const aCreated = a.createdAt.getTime();
      const bCreated = b.createdAt.getTime();
      if (aCreated !== bCreated) {
        return aCreated - bCreated;
      }

      return a.id.localeCompare(b.id);
    });

    return result.map((task) => cloneTask(task));
  }

  private ensureActive(task: TaskRecord): void {
    if (task.status !== 'todo' && task.status !== 'in_progress') {
      throw new InvalidTransitionError(
        `Task ${task.id} is in ${task.status} status, not active`,
      );
    }
  }
}
