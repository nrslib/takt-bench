import { describe, expect, it } from 'vitest';
import { InvalidTransitionError, NotFoundError, ValidationError } from '../src/types.js';
import { FixedClock, T0, makeService } from './helpers.js';

const T1 = new Date('2026-07-02T00:00:00.000Z');

describe('TaskService.updateTask', () => {
  it('title を更新し updatedAt が進み createdAt は変わらない', () => {
    const clock = new FixedClock(T0);
    const { service } = makeService(clock);
    const created = service.createTask({ title: 'before' });
    clock.set(T1);

    const updated = service.updateTask(created.id, { title: 'after' });

    expect(updated.title).toBe('after');
    expect(updated.createdAt).toEqual(T0);
    expect(updated.updatedAt).toEqual(T1);
  });

  it('id と status は更新で変わらない', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't' });

    const updated = service.updateTask(created.id, { title: 'renamed' });

    expect(updated.id).toBe(created.id);
    expect(updated.status).toBe('todo');
  });

  it('空 title への更新は ValidationError', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't' });

    expect(() => service.updateTask(created.id, { title: '  ' })).toThrow(ValidationError);
  });

  it('201 文字 title への更新は ValidationError', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't' });

    expect(() => service.updateTask(created.id, { title: 'a'.repeat(201) }))
      .toThrow(ValidationError);
  });

  it('tags 更新も正規化される', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't', tags: ['old'] });

    const updated = service.updateTask(created.id, { tags: [' NEW ', 'new', 'Other'] });

    expect(updated.tags).toEqual(['new', 'other']);
  });

  it('dueDate: null で期限を解除できる', () => {
    const { service } = makeService();
    const created = service.createTask({
      title: 't',
      dueDate: new Date(T0.getTime() + 1000),
    });

    expect(service.updateTask(created.id, { dueDate: null }).dueDate).toBeUndefined();
  });

  it('dueDate: undefined は変更なし', () => {
    const { service } = makeService();
    const due = new Date(T0.getTime() + 1000);
    const created = service.createTask({ title: 't', dueDate: due });

    expect(service.updateTask(created.id, { title: 'renamed' }).dueDate).toEqual(due);
  });

  it('過去の dueDate への更新は ValidationError', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't' });

    expect(() => service.updateTask(created.id, { dueDate: new Date(T0.getTime() - 1) }))
      .toThrow(ValidationError);
  });

  it('done のタスクの更新は InvalidTransitionError', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't' });
    service.changeStatus(created.id, 'in_progress');
    service.changeStatus(created.id, 'done');

    expect(() => service.updateTask(created.id, { title: 'x' }))
      .toThrow(InvalidTransitionError);
  });

  it('cancelled のタスクの更新は InvalidTransitionError', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't' });
    service.changeStatus(created.id, 'cancelled');

    expect(() => service.updateTask(created.id, { title: 'x' }))
      .toThrow(InvalidTransitionError);
  });

  it('存在しない id は NotFoundError', () => {
    const { service } = makeService();

    expect(() => service.updateTask('missing', { title: 'x' })).toThrow(NotFoundError);
  });
});

describe('TaskService.changeStatus', () => {
  it.each([
    ['todo', 'in_progress'],
    ['todo', 'cancelled'],
  ] as const)('%s → %s は許可される', (_from, next) => {
    const { service } = makeService();
    const created = service.createTask({ title: 't' });

    expect(service.changeStatus(created.id, next).status).toBe(next);
  });

  it.each([
    ['done'],
    ['todo'],
    ['cancelled'],
  ] as const)('in_progress → %s は許可される', (next) => {
    const { service } = makeService();
    const created = service.createTask({ title: 't' });
    service.changeStatus(created.id, 'in_progress');

    expect(service.changeStatus(created.id, next).status).toBe(next);
  });

  it('todo → done の飛び級は InvalidTransitionError', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't' });

    expect(() => service.changeStatus(created.id, 'done')).toThrow(InvalidTransitionError);
  });

  it('同一状態への遷移は InvalidTransitionError', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't' });

    expect(() => service.changeStatus(created.id, 'todo')).toThrow(InvalidTransitionError);
  });

  it('done からの遷移は InvalidTransitionError', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't' });
    service.changeStatus(created.id, 'in_progress');
    service.changeStatus(created.id, 'done');

    expect(() => service.changeStatus(created.id, 'in_progress'))
      .toThrow(InvalidTransitionError);
  });

  it('cancelled からの遷移は InvalidTransitionError', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 't' });
    service.changeStatus(created.id, 'cancelled');

    expect(() => service.changeStatus(created.id, 'todo')).toThrow(InvalidTransitionError);
  });

  it('遷移で updatedAt が進む', () => {
    const clock = new FixedClock(T0);
    const { service } = makeService(clock);
    const created = service.createTask({ title: 't' });
    clock.set(T1);

    expect(service.changeStatus(created.id, 'in_progress').updatedAt).toEqual(T1);
  });

  it('存在しない id は NotFoundError', () => {
    const { service } = makeService();

    expect(() => service.changeStatus('missing', 'in_progress')).toThrow(NotFoundError);
  });
});
