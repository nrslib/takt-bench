import { describe, expect, it } from 'vitest';
import type { TaskRecord } from '../src/types.js';
import { InMemoryTaskRepository } from '../src/index.js';

function record(id: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id,
    title: `task ${id}`,
    description: '',
    priority: 'medium',
    status: 'todo',
    assignee: undefined,
    tags: ['work'],
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    dueDate: undefined,
    ...overrides,
  };
}

describe('InMemoryTaskRepository', () => {
  it('save して findById で取得できる', () => {
    const repo = new InMemoryTaskRepository();
    repo.save(record('a'));

    expect(repo.findById('a')?.title).toBe('task a');
  });

  it('同じ id の save は上書きする（upsert）', () => {
    const repo = new InMemoryTaskRepository();
    repo.save(record('a'));
    repo.save(record('a', { title: 'renamed' }));

    expect(repo.all()).toHaveLength(1);
    expect(repo.findById('a')?.title).toBe('renamed');
  });

  it('存在しない id の findById は undefined を返す', () => {
    const repo = new InMemoryTaskRepository();

    expect(repo.findById('missing')).toBeUndefined();
  });

  it('save 後に引数オブジェクトを変更しても内部状態は変わらない', () => {
    const repo = new InMemoryTaskRepository();
    const input = record('a');
    repo.save(input);
    input.title = 'mutated';
    input.tags.push('mutated');

    expect(repo.findById('a')?.title).toBe('task a');
    expect(repo.findById('a')?.tags).toEqual(['work']);
  });

  it('findById の返り値を変更しても内部状態は変わらない', () => {
    const repo = new InMemoryTaskRepository();
    repo.save(record('a'));
    const got = repo.findById('a')!;
    got.title = 'mutated';
    got.tags.push('mutated');

    expect(repo.findById('a')?.title).toBe('task a');
    expect(repo.findById('a')?.tags).toEqual(['work']);
  });

  it('all の返り値の要素を変更しても内部状態は変わらない', () => {
    const repo = new InMemoryTaskRepository();
    repo.save(record('a'));
    const list = repo.all();
    list[0]!.tags.push('mutated');

    expect(repo.findById('a')?.tags).toEqual(['work']);
  });

  it('delete は存在した場合 true を返し実体を消す', () => {
    const repo = new InMemoryTaskRepository();
    repo.save(record('a'));

    expect(repo.delete('a')).toBe(true);
    expect(repo.findById('a')).toBeUndefined();
  });

  it('delete は存在しない場合 false を返す', () => {
    const repo = new InMemoryTaskRepository();

    expect(repo.delete('missing')).toBe(false);
  });

  it('all は保存順で返す', () => {
    const repo = new InMemoryTaskRepository();
    repo.save(record('b'));
    repo.save(record('a'));
    repo.save(record('c'));

    expect(repo.all().map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });
});
