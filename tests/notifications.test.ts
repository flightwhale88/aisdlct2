import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/timezone', async () => {
  const actual = await vi.importActual<typeof import('@/lib/timezone')>('@/lib/timezone');
  return {
    ...actual,
    getSingaporeNow: () => new Date('2026-07-14T10:00:00+08:00'),
  };
});

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
    subtasks: never[];
  };

  const store = {
    users: new Set<number>(),
    todos: [] as Todo[],
    nextTodoId: 1,
  };

  const cloneTodo = (todo: Todo): Todo => ({ ...todo, subtasks: [] });

  const db = {
    pragma() {
      return 1;
    },
    transaction<T extends (...args: never[]) => unknown>(fn: T): T {
      return ((...args: never[]) => fn(...args)) as T;
    },
    exec(sql: string): void {
      if (sql.includes('DELETE FROM subtasks')) {
        store.todos = [];
      }
      if (sql.includes('DELETE FROM todos')) {
        store.todos = [];
      }
      if (sql.includes('DELETE FROM users')) {
        store.users.clear();
      }
    },
    prepare(sql: string) {
      return {
        run(...args: unknown[]) {
          if (sql.includes('INSERT INTO users')) {
            store.users.add(Number(args[0]));
            return { changes: 1 };
          }

          return { changes: 0 };
        },
        get<T>() {
          if (sql.includes('SELECT COUNT(*) AS count FROM todos')) {
            return { count: store.todos.length } as T;
          }

          return undefined as T;
        },
        all<T>() {
          return [] as T;
        },
      };
    },
  };

  const todoDB = {
    findById(id: number): Todo | null {
      const todo = store.todos.find((item) => item.id === id);
      return todo ? cloneTodo(todo) : null;
    },
    findAllByUser(userId: number): Todo[] {
      return store.todos.filter((item) => item.user_id === userId).map(cloneTodo);
    },
    create(input: {
      user_id: number;
      title: string;
      due_date?: string | null;
      priority?: 'high' | 'medium' | 'low';
      is_recurring?: boolean;
      recurrence_pattern?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
      reminder_minutes?: number | null;
      last_notification_sent?: string | null;
      tags?: string[];
      completed?: boolean;
    }): Todo {
      const created: Todo = {
        id: store.nextTodoId++,
        user_id: input.user_id,
        title: input.title.trim(),
        completed: input.completed ?? false,
        due_date: input.due_date ?? null,
        priority: input.priority ?? 'medium',
        is_recurring: input.is_recurring ?? false,
        recurrence_pattern: input.recurrence_pattern ?? null,
        reminder_minutes: input.reminder_minutes ?? null,
        last_notification_sent: input.last_notification_sent ?? null,
        tags: input.tags ?? [],
        created_at: '2026-07-14T00:00:00+08:00',
        updated_at: null,
        subtasks: [],
      };

      store.todos.push(created);
      return cloneTodo(created);
    },
    update(
      id: number,
      input: Partial<{
        title: string;
        completed: boolean;
        due_date: string | null;
        priority: 'high' | 'medium' | 'low';
        is_recurring: boolean;
        recurrence_pattern: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
        reminder_minutes: number | null;
        last_notification_sent: string | null;
        tags: string[];
      }>,
    ): Todo {
      const index = store.todos.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new Error('Todo not found');
      }

      const current = store.todos[index];
      const dueDateChanged = input.due_date !== undefined;
      const reminderChanged = input.reminder_minutes !== undefined;

      const updated: Todo = {
        ...current,
        title: input.title === undefined ? current.title : input.title.trim(),
        completed: input.completed === undefined ? current.completed : input.completed,
        due_date: dueDateChanged ? input.due_date ?? null : current.due_date,
        priority: input.priority ?? current.priority,
        is_recurring: input.is_recurring === undefined ? current.is_recurring : input.is_recurring,
        recurrence_pattern:
          input.recurrence_pattern === undefined ? current.recurrence_pattern : input.recurrence_pattern,
        reminder_minutes: reminderChanged ? input.reminder_minutes ?? null : current.reminder_minutes,
        last_notification_sent: dueDateChanged || reminderChanged ? null : input.last_notification_sent ?? current.last_notification_sent,
        tags: input.tags === undefined ? current.tags : input.tags,
        updated_at: '2026-07-14T00:00:00+08:00',
      };

      store.todos[index] = updated;
      return cloneTodo(updated);
    },
    delete(id: number): void {
      store.todos = store.todos.filter((item) => item.id !== id);
    },
  };

  const subtaskDB = {
    findById() {
      return null;
    },
    findByTodoId() {
      return [];
    },
    create() {
      throw new Error('Not implemented');
    },
    update() {
      throw new Error('Not implemented');
    },
    delete() {
      return undefined;
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

import { clearTestSession, setTestSession } from '@/lib/auth';
import { db, todoDB } from '@/lib/db';

import { GET as checkNotifications } from '@/app/api/notifications/check/route';
import { PUT as updateTodo } from '@/app/api/todos/[id]/route';
import { resetTestDatabase, seedTestUser, TEST_USER_ID } from './helpers';

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost/api/todos/1', {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  resetTestDatabase();
  seedTestUser(TEST_USER_ID);
  setTestSession({ userId: TEST_USER_ID });
});

afterEach(() => {
  clearTestSession();
});

describe('GET /api/notifications/check', () => {
  it('returns only todos whose reminder window has opened', async () => {
    todoDB.create({
      user_id: TEST_USER_ID,
      title: 'Boundary todo',
      due_date: '2026-07-14T10:15:00',
      reminder_minutes: 15,
    });
    todoDB.create({
      user_id: TEST_USER_ID,
      title: 'Too early todo',
      due_date: '2026-07-14T10:16:00',
      reminder_minutes: 15,
    });

    const response = await checkNotifications(new Request('http://localhost/api/notifications/check') as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: [{ title: 'Boundary todo' }],
    });
    expect(todoDB.findById(1)?.last_notification_sent).toBe('2026-07-14T02:00:00.000Z');
  });

  it('excludes todos that were already notified', async () => {
    todoDB.create({
      user_id: TEST_USER_ID,
      title: 'Already notified',
      due_date: '2026-07-14T10:15:00',
      reminder_minutes: 15,
      last_notification_sent: '2026-07-14T09:59:59+08:00',
    });

    const response = await checkNotifications(new Request('http://localhost/api/notifications/check') as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: [],
    });
  });
});

describe('PUT /api/todos/[id]', () => {
  it('clears last_notification_sent when due date changes', async () => {
    const todo = todoDB.create({
      user_id: TEST_USER_ID,
      title: 'Move me',
      due_date: '2026-07-14T10:15:00',
      reminder_minutes: 15,
      last_notification_sent: '2026-07-14T09:59:59+08:00',
    });

    const response = await updateTodo(
      makeRequest('PUT', { due_date: '2026-07-14T11:15:00' }) as never,
      { params: Promise.resolve({ id: String(todo.id) }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.todo.last_notification_sent).toBeNull();
    expect(todoDB.findById(todo.id)?.last_notification_sent).toBeNull();
  });

  it('clears last_notification_sent when reminder minutes change', async () => {
    const todo = todoDB.create({
      user_id: TEST_USER_ID,
      title: 'Re-arm me',
      due_date: '2026-07-14T10:30:00',
      reminder_minutes: 15,
      last_notification_sent: '2026-07-14T10:00:00+08:00',
    });

    const response = await updateTodo(
      makeRequest('PUT', { reminder_minutes: 30 }) as never,
      { params: Promise.resolve({ id: String(todo.id) }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.todo.last_notification_sent).toBeNull();
    expect(todoDB.findById(todo.id)?.last_notification_sent).toBeNull();
  });

  it('stores last_notification_sent when the client confirms delivery', async () => {
    const todo = todoDB.create({
      user_id: TEST_USER_ID,
      title: 'Stamp me',
      due_date: '2026-07-14T10:15:00',
      reminder_minutes: 15,
    });

    const stamp = '2026-07-14T10:00:00+08:00';
    const response = await updateTodo(
      makeRequest('PUT', { last_notification_sent: stamp }) as never,
      { params: Promise.resolve({ id: String(todo.id) }) },
    );

    expect(response.status).toBe(200);
    expect(todoDB.findById(todo.id)?.last_notification_sent).toBe(stamp);
    const countRow = db.prepare('SELECT COUNT(*) AS count FROM todos').get() as { count: number };
    expect(countRow.count).toBe(1);
  });

  it('rejects unsupported reminder minutes on create', async () => {
    const { POST } = await import('@/app/api/todos/route');

    const response = await POST(
      new Request('http://localhost/api/todos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Bad reminder',
          due_date: '2026-07-14T10:30:00',
          reminder_minutes: 999,
        }),
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid reminder minutes',
    });
  });

  it('rejects unsupported reminder minutes on update', async () => {
    const todo = todoDB.create({
      user_id: TEST_USER_ID,
      title: 'Bad reminder update',
      due_date: '2026-07-14T10:30:00',
      reminder_minutes: 15,
    });

    const response = await updateTodo(
      makeRequest('PUT', { reminder_minutes: 999 }) as never,
      { params: Promise.resolve({ id: String(todo.id) }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid reminder minutes',
    });
  });
});