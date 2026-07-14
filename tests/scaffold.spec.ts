import { beforeEach, describe, expect, it } from 'vitest';

import { db, subtaskDB, todoDB } from '@/lib/db';

import { resetTestDatabase, seedTestUser } from './helpers';

describe('Next.js scaffold', () => {
  beforeEach(() => {
    resetTestDatabase();
  });

  it('enables foreign keys and cascades subtasks when deleting a todo', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);

    const userId = seedTestUser();
    const todo = todoDB.create({
      user_id: userId,
      title: 'Smoke test todo',
    });

    subtaskDB.create(todo.id, { title: 'First subtask' });

    expect(subtaskDB.findByTodoId(todo.id)).toHaveLength(1);

    todoDB.delete(todo.id);

    expect(subtaskDB.findByTodoId(todo.id)).toEqual([]);
  });

  it('imports the app shell and todo route modules', async () => {
    const layoutModule = await import('../app/layout');
    const pageModule = await import('../app/page');
    const todosRouteModule = await import('../app/api/todos/route');
    const todoRouteModule = await import('../app/api/todos/[id]/route');

    expect(typeof layoutModule.default).toBe('function');
    expect(typeof pageModule.default).toBe('function');
    expect(typeof todosRouteModule.GET).toBe('function');
    expect(typeof todosRouteModule.POST).toBe('function');
    expect(typeof todoRouteModule.GET).toBe('function');
    expect(typeof todoRouteModule.PUT).toBe('function');
    expect(typeof todoRouteModule.DELETE).toBe('function');
  });
});