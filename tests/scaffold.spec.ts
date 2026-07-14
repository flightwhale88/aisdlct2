import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  type Todo = {
    id: number;
    user_id: number;
    title: string;
    completed: boolean;
    due_date: string | null;
    priority: 'high' | 'medium' | 'low';
    is_recurring: boolean;
    recurrence_pattern: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
    reminder_minutes: number | null;
    last_notification_sent: string | null;
    tags: string[];
    created_at: string;
    updated_at: string | null;
    subtasks: Array<{ id: number; todo_id: number; title: string; completed: boolean; position: number; created_at: string }>;
  };

  const store = {
    todos: [] as Todo[],
    subtasks: [] as Todo['subtasks'],
    nextTodoId: 1,
    nextSubtaskId: 1,
  };

  const db = {
    pragma() {
      return 1;
    },
    exec() {
      store.todos = [];
      store.subtasks = [];
    },
    prepare(sql: string) {
      return {
        run(...args: unknown[]) {
          if (sql.includes('INSERT INTO users')) {
            return { changes: 1, lastInsertRowid: Number(args[0]) };
          }

          return { changes: 0, lastInsertRowid: 0 };
        },
        get() {
          return undefined;
        },
        all() {
          return [];
        },
      };
    },
  };

  const todoDB = {
    create(input: { user_id: number; title: string }): Todo {
      const todo: Todo = {
        id: store.nextTodoId++,
        user_id: input.user_id,
        title: input.title,
        completed: false,
        due_date: null,
        priority: 'medium',
        is_recurring: false,
        recurrence_pattern: null,
        reminder_minutes: null,
        last_notification_sent: null,
        tags: [],
        created_at: '2026-07-14T00:00:00+08:00',
        updated_at: null,
        subtasks: [],
      };

      store.todos.push(todo);
      return todo;
    },
    delete(id: number): void {
      store.todos = store.todos.filter((todo) => todo.id !== id);
      store.subtasks = store.subtasks.filter((subtask) => subtask.todo_id !== id);
    },
    findAllByUser(): Todo[] {
      return store.todos;
    },
    findById(id: number): Todo | null {
      return store.todos.find((todo) => todo.id === id) ?? null;
    },
  };

  const subtaskDB = {
    create(todoId: number, data: { title: string }) {
      const subtask = {
        id: store.nextSubtaskId++,
        todo_id: todoId,
        title: data.title,
        completed: false,
        position: 0,
        created_at: '2026-07-14T00:00:00+08:00',
      };
      store.subtasks.push(subtask);
      return subtask;
    },
    findByTodoId(todoId: number) {
      return store.subtasks.filter((subtask) => subtask.todo_id === todoId);
    },
  };

  return { db, todoDB, subtaskDB };
});

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: () => undefined,
  }),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json(body: unknown, init?: { status?: number }) {
      return new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  },
}));

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
    const todosRouteModule = await import('../app/api/todos/route');
    const todoRouteModule = await import('../app/api/todos/[id]/route');
    const notificationsRouteModule = await import('../app/api/notifications/check/route');

    expect(typeof layoutModule.default).toBe('function');
    expect(typeof todosRouteModule.GET).toBe('function');
    expect(typeof todosRouteModule.POST).toBe('function');
    expect(typeof todoRouteModule.GET).toBe('function');
    expect(typeof todoRouteModule.PUT).toBe('function');
    expect(typeof todoRouteModule.DELETE).toBe('function');
    expect(typeof notificationsRouteModule.GET).toBe('function');
  });
});