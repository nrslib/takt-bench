import { describe, expect, it } from 'vitest';
import { InvalidTransitionError, NotFoundError, ValidationError } from '../src/types.js';
import { FixedClock, T0, makeService } from './helpers.js';

const DAY = 86_400_000;

describe('TaskService.assign / unassign', () => {
  it('assign は trim した担当者を設定し updatedAt を進める', () => {
    const clock = new FixedClock(T0);
    const { service } = makeService(clock);
    const created = service.createTask({ title: 't' });
    clock.set(new Date(T0.getTime() + 1000));

    const assigned = service.assign(created.id, '  alice ');

    expect(assigned.assignee).toBe('alice');
    expect(assigned.updatedAt).toEqual(new Date(T0.getTime() + 1000));
  });

  it('空白だけの assignee は ValidationError', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't' });

    expect(() => service.assign(created.id, '  ')).toThrow(ValidationError);
  });

  it('done のタスクへの assign は InvalidTransitionError', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't' });
    service.changeStatus(created.id, 'in_progress');
    service.changeStatus(created.id, 'done');

    expect(() => service.assign(created.id, 'alice')).toThrow(InvalidTransitionError);
  });

  it('unassign は担当者を外す', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't', assignee: 'alice' });

    expect(service.unassign(created.id).assignee).toBeUndefined();
  });

  it('存在しない id への assign は NotFoundError', () => {
    const { service } = makeService();

    expect(() => service.assign('missing', 'alice')).toThrow(NotFoundError);
  });
});

describe('TaskService.listTasks', () => {
  it('status で絞り込める', () => {
    const { service } = makeService();
    const a = service.createTask({ title: 'a' });
    service.createTask({ title: 'b' });
    service.changeStatus(a.id, 'in_progress');

    expect(service.listTasks({ status: 'in_progress' }).map((t) => t.title)).toEqual(['a']);
  });

  it('assignee で絞り込める', () => {
    const { service } = makeService();
    service.createTask({ title: 'a', assignee: 'alice' });
    service.createTask({ title: 'b', assignee: 'bob' });

    expect(service.listTasks({ assignee: 'alice' }).map((t) => t.title)).toEqual(['a']);
  });

  it('tag フィルタは正規化して比較する', () => {
    const { service } = makeService();
    service.createTask({ title: 'a', tags: ['Work'] });
    service.createTask({ title: 'b', tags: ['home'] });

    expect(service.listTasks({ tag: '  WORK ' }).map((t) => t.title)).toEqual(['a']);
  });

  it('複数条件は AND になる', () => {
    const { service } = makeService();
    service.createTask({ title: 'a', assignee: 'alice', tags: ['work'] });
    service.createTask({ title: 'b', assignee: 'alice', tags: ['home'] });

    expect(service.listTasks({ assignee: 'alice', tag: 'work' }).map((t) => t.title))
      .toEqual(['a']);
  });

  it('overdueAsOf は期限切れのアクティブなタスクだけを返す', () => {
    const { service } = makeService();
    const overdue = service.createTask({ title: 'overdue', dueDate: new Date(T0.getTime() + DAY) });
    service.createTask({ title: 'future', dueDate: new Date(T0.getTime() + 10 * DAY) });
    service.createTask({ title: 'no-due' });
    const done = service.createTask({ title: 'done-overdue', dueDate: new Date(T0.getTime() + DAY) });
    service.changeStatus(done.id, 'in_progress');
    service.changeStatus(done.id, 'done');
    service.changeStatus(overdue.id, 'in_progress');

    const result = service.listTasks({ overdueAsOf: new Date(T0.getTime() + 2 * DAY) });

    expect(result.map((t) => t.title)).toEqual(['overdue']);
  });

  it('priority high → medium → low の順で並ぶ', () => {
    const { service } = makeService();
    service.createTask({ title: 'low', priority: 'low' });
    service.createTask({ title: 'high', priority: 'high' });
    service.createTask({ title: 'medium' });

    expect(service.listTasks().map((t) => t.title)).toEqual(['high', 'medium', 'low']);
  });

  it('同 priority では dueDate 昇順・未設定は最後', () => {
    const { service } = makeService();
    service.createTask({ title: 'no-due' });
    service.createTask({ title: 'later', dueDate: new Date(T0.getTime() + 2 * DAY) });
    service.createTask({ title: 'sooner', dueDate: new Date(T0.getTime() + DAY) });

    expect(service.listTasks().map((t) => t.title)).toEqual(['sooner', 'later', 'no-due']);
  });

  it('dueDate も同じなら createdAt 昇順', () => {
    const clock = new FixedClock(T0);
    const { service } = makeService(clock);
    const due = new Date(T0.getTime() + DAY);
    service.createTask({ title: 'first', dueDate: due });
    clock.set(new Date(T0.getTime() + 1000));
    service.createTask({ title: 'second', dueDate: due });

    expect(service.listTasks().map((t) => t.title)).toEqual(['first', 'second']);
  });

  it('返り値を変更しても内部状態は変わらない', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't', tags: ['work'] });
    const list = service.listTasks();
    list[0]!.title = 'mutated';
    list[0]!.tags.push('mutated');

    expect(service.getTask(created.id).title).toBe('t');
    expect(service.getTask(created.id).tags).toEqual(['work']);
  });

  it('フィルタなしは全件返す', () => {
    const { service } = makeService();
    service.createTask({ title: 'a' });
    service.createTask({ title: 'b' });

    expect(service.listTasks()).toHaveLength(2);
  });
});
