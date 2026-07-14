import Database from 'better-sqlite3';
import path from 'node:path';
import { getSingaporeNow } from '@/lib/timezone';

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const PRIORITY_VALUES: Priority[] = ['high', 'medium', 'low'];
export const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string | null;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string | null;
  subtasks?: Subtask[];
  tags?: Tag[];
}

export interface CreateTodoInput {
  user_id: number;
  title: string;
  due_date?: string | null;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
  tag_ids?: number[];
}

export interface UpdateTodoInput extends Partial<Omit<CreateTodoInput, 'user_id'>> {
  completed?: boolean;
}

interface TodoRow {
  id: number;
  user_id: number;
  title: string;
  completed: number;
  due_date: string | null;
  priority: Priority;
  is_recurring: number;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string | null;
}

const databasePath = path.join(process.cwd(), 'todos.db');
const db = new Database(databasePath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_pattern TEXT,
    reminder_minutes INTEGER,
    last_notification_sent TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
  CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    UNIQUE(user_id, name)
  );

  CREATE TABLE IF NOT EXISTS todo_tags (
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (todo_id, tag_id)
  );
`);

function toTodo(row: TodoRow): Todo {
  return {
    ...row,
    completed: row.completed === 1,
    is_recurring: row.is_recurring === 1,
  };
}

function nowIso(): string {
  return getSingaporeNow().toISOString();
}

export const userDB = {
  findByUsername(username: string): { id: number; username: string } | undefined {
    const statement = db.prepare('SELECT id, username FROM users WHERE username = ?');
    return statement.get(username) as { id: number; username: string } | undefined;
  },

  create(username: string): { id: number; username: string } {
    const createdAt = nowIso();
    const statement = db.prepare('INSERT INTO users (username, created_at) VALUES (?, ?)');
    const result = statement.run(username, createdAt);
    return {
      id: Number(result.lastInsertRowid),
      username,
    };
  },

  createIfMissing(username: string): { id: number; username: string } {
    const existing = this.findByUsername(username);
    if (existing) {
      return existing;
    }
    return this.create(username);
  },
};

export const todoDB = {
  create(input: CreateTodoInput): Todo {
    const createdAt = nowIso();
    const statement = db.prepare(`
      INSERT INTO todos (
        user_id,
        title,
        completed,
        due_date,
        priority,
        is_recurring,
        recurrence_pattern,
        reminder_minutes,
        last_notification_sent,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = statement.run(
      input.user_id,
      input.title,
      0,
      input.due_date ?? null,
      input.priority ?? 'medium',
      input.is_recurring ? 1 : 0,
      input.recurrence_pattern ?? null,
      input.reminder_minutes ?? null,
      null,
      createdAt,
      null
    );

    const created = this.findById(Number(result.lastInsertRowid));
    if (!created) {
      throw new Error('Failed to create todo');
    }
    return created;
  },

  findAllByUser(userId: number): Todo[] {
    const statement = db.prepare('SELECT * FROM todos WHERE user_id = ?');
    const rows = statement.all(userId) as TodoRow[];
    return rows.map(toTodo);
  },

  findById(id: number): Todo | null {
    const statement = db.prepare('SELECT * FROM todos WHERE id = ?');
    const row = statement.get(id) as TodoRow | undefined;
    return row ? toTodo(row) : null;
  },

  update(id: number, input: UpdateTodoInput): Todo {
    const existing = this.findById(id);
    if (!existing) {
      throw new Error('Todo not found');
    }

    const updated: Todo = {
      ...existing,
      title: input.title ?? existing.title,
      completed: input.completed ?? existing.completed,
      due_date: input.due_date === undefined ? existing.due_date : (input.due_date ?? null),
      priority: input.priority ?? existing.priority,
      is_recurring: input.is_recurring ?? existing.is_recurring,
      recurrence_pattern:
        input.recurrence_pattern === undefined
          ? existing.recurrence_pattern
          : (input.recurrence_pattern ?? null),
      reminder_minutes:
        input.reminder_minutes === undefined
          ? existing.reminder_minutes
          : (input.reminder_minutes ?? null),
      updated_at: nowIso(),
    };

    const statement = db.prepare(`
      UPDATE todos
      SET
        title = ?,
        completed = ?,
        due_date = ?,
        priority = ?,
        is_recurring = ?,
        recurrence_pattern = ?,
        reminder_minutes = ?,
        updated_at = ?
      WHERE id = ?
    `);

    statement.run(
      updated.title,
      updated.completed ? 1 : 0,
      updated.due_date,
      updated.priority,
      updated.is_recurring ? 1 : 0,
      updated.recurrence_pattern,
      updated.reminder_minutes,
      updated.updated_at,
      id
    );

    const refreshed = this.findById(id);
    if (!refreshed) {
      throw new Error('Failed to refresh todo');
    }
    return refreshed;
  },

  delete(id: number): void {
    const statement = db.prepare('DELETE FROM todos WHERE id = ?');
    statement.run(id);
  },
};
