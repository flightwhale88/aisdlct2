import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    tags: string[];
    last_notification_sent: string | null;
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

          if (sql.includes('SELECT COUNT(*) AS count FROM todos')) {
            return { changes: 0 };
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
        tags: input.tags ?? [],
        last_notification_sent: null,
        created_at: '2025-01-01T00:00:00+08:00',
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
        tags?: string[];
      }>,
    ): Todo {
      const index = store.todos.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new Error('Todo not found');
      }

      const current = store.todos[index];
      const updated: Todo = {
        ...current,
        title: input.title === undefined ? current.title : input.title.trim(),
        completed: input.completed === undefined ? current.completed : input.completed,
        due_date: input.due_date === undefined ? current.due_date : input.due_date,
        priority: input.priority ?? current.priority,
        is_recurring: input.is_recurring === undefined ? current.is_recurring : input.is_recurring,
        recurrence_pattern:
          input.recurrence_pattern === undefined ? current.recurrence_pattern : input.recurrence_pattern,
        reminder_minutes:
          input.reminder_minutes === undefined ? current.reminder_minutes : input.reminder_minutes,
        tags: input.tags === undefined ? current.tags : input.tags,
        updated_at: '2025-01-01T00:00:00+08:00',
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
      throw new Error('Not implemented in test mock');
    },
    update() {
      throw new Error('Not implemented in test mock');
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
import { calculateNextDueDate } from '@/lib/recurrence';

import { POST } from '@/app/api/todos/route';
import { PUT } from '@/app/api/todos/[id]/route';
import { resetTestDatabase, seedTestUser, TEST_USER_ID } from './helpers';

function makeJsonRequest(url: string, method: string, body: unknown): never {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

function makeTodoRequest(body: unknown): never {
  return makeJsonRequest('http://localhost/api/todos', 'POST', body);
}

beforeEach(() => {
  resetTestDatabase();
  seedTestUser(TEST_USER_ID);
  setTestSession({ userId: TEST_USER_ID });
});

afterEach(() => {
  clearTestSession();
});

describe('POST /api/todos recurring validation', () => {
  it('rejects recurring todos without a due date', async () => {
    const response = await POST(
      makeTodoRequest({
        title: 'Repeat me',
        is_recurring: true,
        recurrence_pattern: 'daily',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Recurring todos require a due date',
    });
  });

  it('rejects invalid recurrence patterns', async () => {
    const response = await POST(
      makeTodoRequest({
        title: 'Repeat me',
        due_date: '2025-11-10T14:00',
        is_recurring: true,
        recurrence_pattern: 'fortnightly',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid recurrence pattern',
    });
  });

  it('persists recurring todo fields on create', async () => {
    const response = await POST(
      makeTodoRequest({
        title: 'Weekly review',
        due_date: '2099-11-10T14:00',
        priority: 'high',
        is_recurring: true,
        recurrence_pattern: 'weekly',
        reminder_minutes: 30,
        tags: ['work', 'review'],
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      title: 'Weekly review',
      priority: 'high',
      is_recurring: true,
      recurrence_pattern: 'weekly',
      reminder_minutes: 30,
      tags: ['work', 'review'],
    });
  });
});

describe('PUT /api/todos/[id] recurring completion', () => {
  it('creates exactly one next instance when completing a recurring todo', async () => {
    const createResponse = await POST(
      makeTodoRequest({
        title: 'Monthly bill',
        due_date: '2099-01-31T09:00',
        priority: 'medium',
        is_recurring: true,
        recurrence_pattern: 'monthly',
        reminder_minutes: 15,
        tags: ['finance'],
      }),
    );
    const created = await createResponse.json();

    const response = await PUT(
      makeJsonRequest(`http://localhost/api/todos/${created.id}`, 'PUT', {
        completed: true,
      }),
      { params: Promise.resolve({ id: String(created.id) }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.todo.completed).toBe(true);
    expect(payload.nextInstance.completed).toBe(false);
    expect(payload.nextInstance.due_date).toBe(calculateNextDueDate('2099-01-31T09:00', 'monthly'));
    expect(payload.nextInstance.title).toBe('Monthly bill');
    expect(payload.nextInstance.priority).toBe('medium');
    expect(payload.nextInstance.recurrence_pattern).toBe('monthly');
    expect(payload.nextInstance.reminder_minutes).toBe(15);
    expect(payload.nextInstance.tags).toEqual(['finance']);
    expect(todoDB.findAllByUser(TEST_USER_ID)).toHaveLength(2);
  });

  it('does not create a duplicate next instance on a second completion request', async () => {
    const createResponse = await POST(
      makeTodoRequest({
        title: 'Daily habit',
        due_date: '2099-11-10T14:00',
        is_recurring: true,
        recurrence_pattern: 'daily',
      }),
    );
    const created = await createResponse.json();

    const firstResponse = await PUT(
      makeJsonRequest(`http://localhost/api/todos/${created.id}`, 'PUT', {
        completed: true,
      }),
      { params: Promise.resolve({ id: String(created.id) }) },
    );

    expect(firstResponse.status).toBe(200);

    const secondResponse = await PUT(
      makeJsonRequest(`http://localhost/api/todos/${created.id}`, 'PUT', {
        completed: true,
      }),
      { params: Promise.resolve({ id: String(created.id) }) },
    );

    expect(secondResponse.status).toBe(200);
    expect(todoDB.findAllByUser(TEST_USER_ID)).toHaveLength(2);
  });

  it('lets a user disable recurrence without deleting existing instances', async () => {
    const createResponse = await POST(
      makeTodoRequest({
        title: 'Stop recurring',
        due_date: '2099-11-10T14:00',
        is_recurring: true,
        recurrence_pattern: 'weekly',
        tags: ['ops'],
      }),
    );
    const created = await createResponse.json();

    const updateResponse = await PUT(
      makeJsonRequest(`http://localhost/api/todos/${created.id}`, 'PUT', {
        is_recurring: false,
      }),
      { params: Promise.resolve({ id: String(created.id) }) },
    );

    expect(updateResponse.status).toBe(200);
    const payload = await updateResponse.json();
    expect(payload.todo.is_recurring).toBe(false);
    expect(payload.todo.recurrence_pattern).toBeNull();
    expect(todoDB.findById(created.id)?.recurrence_pattern).toBeNull();
    const countRow = db.prepare('SELECT COUNT(*) AS count FROM todos').get() as { count: number };
    expect(countRow.count).toBe(1);
  });
});
