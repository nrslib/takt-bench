import { describe, expect, it } from 'vitest';
import { ValidationError } from '../src/types.js';
import { FixedClock, T0, makeService } from './helpers.js';

describe('TaskService.createTask', () => {
  it('最小入力でデフォルト値が入る', () => {
    const { service } = makeService();
    const task = service.createTask({ title: 'write report' });

    expect(task.id).toBe('task-1');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.description).toBe('');
    expect(task.assignee).toBeUndefined();
    expect(task.tags).toEqual([]);
    expect(task.dueDate).toBeUndefined();
    expect(task.createdAt).toEqual(T0);
    expect(task.updatedAt).toEqual(T0);
  });

  it('作成したタスクは getTask で取得できる', () => {
    const { service } = makeService();
    const created = service.createTask({ title: 'write report' });

    expect(service.getTask(created.id).title).toBe('write report');
  });

  it('title と description は trim される', () => {
    const { service } = makeService();
    const task = service.createTask({ title: '  padded  ', description: '  note  ' });

    expect(task.title).toBe('padded');
    expect(task.description).toBe('note');
  });

  it('空の title は ValidationError', () => {
    const { service } = makeService();

    expect(() => service.createTask({ title: '' })).toThrow(ValidationError);
  });

  it('空白だけの title は ValidationError', () => {
    const { service } = makeService();

    expect(() => service.createTask({ title: '   ' })).toThrow(ValidationError);
  });

  it('trim 後 201 文字の title は ValidationError', () => {
    const { service } = makeService();

    expect(() => service.createTask({ title: 'a'.repeat(201) })).toThrow(ValidationError);
  });

  it('trim 後 200 文字ちょうどの title は許可される', () => {
    const { service } = makeService();

    expect(service.createTask({ title: 'a'.repeat(200) }).title).toHaveLength(200);
  });

  it('priority を指定できる', () => {
    const { service } = makeService();

    expect(service.createTask({ title: 't', priority: 'high' }).priority).toBe('high');
  });

  it('assignee は trim して保存される', () => {
    const { service } = makeService();

    expect(service.createTask({ title: 't', assignee: '  alice  ' }).assignee).toBe('alice');
  });

  it('空白だけの assignee は ValidationError', () => {
    const { service } = makeService();

    expect(() => service.createTask({ title: 't', assignee: '   ' })).toThrow(ValidationError);
  });

  it('tags は trim・小文字化・空除去・重複除去され順序を保つ', () => {
    const { service } = makeService();
    const task = service.createTask({
      title: 't',
      tags: ['  Work ', 'URGENT', '', 'work', '  ', 'Home'],
    });

    expect(task.tags).toEqual(['work', 'urgent', 'home']);
  });

  it('過去の dueDate は ValidationError', () => {
    const { service } = makeService(new FixedClock(T0));

    expect(() => service.createTask({
      title: 't',
      dueDate: new Date(T0.getTime() - 1),
    })).toThrow(ValidationError);
  });

  it('現在時刻ちょうどの dueDate は許可される', () => {
    const { service } = makeService(new FixedClock(T0));

    expect(service.createTask({ title: 't', dueDate: new Date(T0.getTime()) }).dueDate)
      .toEqual(T0);
  });

  it('未来の dueDate は許可される', () => {
    const { service } = makeService(new FixedClock(T0));
    const due = new Date(T0.getTime() + 86_400_000);

    expect(service.createTask({ title: 't', dueDate: due }).dueDate).toEqual(due);
  });
});
