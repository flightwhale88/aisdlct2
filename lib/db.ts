import { DatabaseSync } from 'node:sqlite';
import path from 'path';

// ─── Database initialization ─────────────────────────────────────────────────

const DB_PATH = path.join(process.cwd(), 'todos.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS authenticators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    credential_public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    credential_device_type TEXT NOT NULL,
    credential_backed_up INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TEXT,
    recurrence TEXT,
    reminder_minutes INTEGER,
    last_notification_sent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, name)
  );

  CREATE TABLE IF NOT EXISTS todo_tags (
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (todo_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    due_offset_days INTEGER,
    recurrence TEXT,
    reminder_minutes INTEGER,
    subtasks TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
  CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
  CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
  CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);
  CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);
  CREATE INDEX IF NOT EXISTS idx_authenticators_credential_id ON authenticators(credential_id);
`);

// ─── Types ───────────────────────────────────────────────────────────────────

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Authenticator {
  id: number;
  user_id: number;
  credential_id: string;
  credential_public_key: string;
  counter: number;
  credential_device_type: string;
  credential_backed_up: number;
  transports: string | null;
  created_at: string;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  completed: number;
  priority: Priority;
  due_date: string | null;
  recurrence: RecurrencePattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  subtasks?: Subtask[];
}

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: number;
  position: number;
  created_at: string;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface CreateTagInput {
  name: string;
  color?: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

export interface Template {
  id: number;
  user_id: number;
  name: string;
  title: string;
  priority: Priority;
  due_offset_days: number | null;
  recurrence: RecurrencePattern | null;
  reminder_minutes: number | null;
  subtasks: string;
  created_at: string;
}

// ─── User DB ─────────────────────────────────────────────────────────────────

export const userDB = {
  findByUsername(username: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as unknown as User | undefined;
  },

  findById(id: number): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as User | undefined;
  },

  create(username: string): User {
    const stmt = db.prepare('INSERT INTO users (username) VALUES (?) RETURNING *');
    return stmt.get(username) as unknown as User;
  },
};

// ─── Authenticator DB ────────────────────────────────────────────────────────

export const authenticatorDB = {
  findByCredentialId(credentialId: string): Authenticator | undefined {
    return db
      .prepare('SELECT * FROM authenticators WHERE credential_id = ?')
      .get(credentialId) as unknown as Authenticator | undefined;
  },

  findAllByUserId(userId: number): Authenticator[] {
    return db
      .prepare('SELECT * FROM authenticators WHERE user_id = ?')
      .all(userId) as unknown[] as Authenticator[];
  },

  create(data: Omit<Authenticator, 'id' | 'created_at'>): Authenticator {
    const stmt = db.prepare(`
      INSERT INTO authenticators
        (user_id, credential_id, credential_public_key, counter,
         credential_device_type, credential_backed_up, transports)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    return stmt.get(
      data.user_id,
      data.credential_id,
      data.credential_public_key,
      data.counter,
      data.credential_device_type,
      data.credential_backed_up,
      data.transports,
    ) as unknown as Authenticator;
  },

  updateCounter(credentialId: string, counter: number): void {
    db.prepare('UPDATE authenticators SET counter = ? WHERE credential_id = ?').run(
      counter,
      credentialId,
    );
  },
};

// ─── Todo DB ─────────────────────────────────────────────────────────────────

export const todoDB = {
  findAllByUser(userId: number): Todo[] {
    const todos = db
      .prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as unknown[] as Todo[];

    return todos.map((todo) => ({
      ...todo,
      tags: tagDB.findByTodoId(todo.id),
      subtasks: subtaskDB.findByTodoId(todo.id),
    }));
  },

  findById(id: number, userId: number): Todo | undefined {
    const todo = db
      .prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?')
      .get(id, userId) as unknown as Todo | undefined;

    if (!todo) return undefined;
    return {
      ...todo,
      tags: tagDB.findByTodoId(todo.id),
      subtasks: subtaskDB.findByTodoId(todo.id),
    };
  },

  create(
    userId: number,
    data: {
      title: string;
      priority?: Priority;
      due_date?: string | null;
      recurrence?: RecurrencePattern | null;
      reminder_minutes?: number | null;
    },
  ): Todo {
    const stmt = db.prepare(`
      INSERT INTO todos (user_id, title, priority, due_date, recurrence, reminder_minutes)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const todo = stmt.get(
      userId,
      data.title,
      data.priority ?? 'medium',
      data.due_date ?? null,
      data.recurrence ?? null,
      data.reminder_minutes ?? null,
    ) as unknown as Todo;
    return { ...todo, tags: [], subtasks: [] };
  },

  update(
    id: number,
    userId: number,
    data: Partial<{
      title: string;
      completed: number;
      priority: Priority;
      due_date: string | null;
      recurrence: RecurrencePattern | null;
      reminder_minutes: number | null;
      last_notification_sent: string | null;
    }>,
  ): Todo | undefined {
    const current = db
      .prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?')
      .get(id, userId) as unknown as Todo | undefined;
    if (!current) return undefined;

    const updated = {
      title: data.title ?? current.title,
      completed: data.completed ?? current.completed,
      priority: data.priority ?? current.priority,
      due_date: 'due_date' in data ? data.due_date : current.due_date,
      recurrence: 'recurrence' in data ? data.recurrence : current.recurrence,
      reminder_minutes:
        'reminder_minutes' in data ? data.reminder_minutes : current.reminder_minutes,
      last_notification_sent:
        'last_notification_sent' in data
          ? data.last_notification_sent
          : current.last_notification_sent,
    };

    db.prepare(`
      UPDATE todos
      SET title = ?, completed = ?, priority = ?, due_date = ?,
          recurrence = ?, reminder_minutes = ?, last_notification_sent = ?,
          updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(
      updated.title,
      updated.completed,
      updated.priority,
      updated.due_date ?? null,
      updated.recurrence ?? null,
      updated.reminder_minutes ?? null,
      updated.last_notification_sent ?? null,
      id,
      userId,
    );

    return this.findById(id, userId);
  },

  delete(id: number, userId: number): boolean {
    const result = db
      .prepare('DELETE FROM todos WHERE id = ? AND user_id = ?')
      .run(id, userId);
    return result.changes > 0;
  },
};

// ─── Subtask DB ──────────────────────────────────────────────────────────────

export const subtaskDB = {
  findByTodoId(todoId: number): Subtask[] {
    return db
      .prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position, created_at')
      .all(todoId) as unknown[] as Subtask[];
  },

  create(todoId: number, title: string, position?: number): Subtask {
    const maxPos = (
      db
        .prepare('SELECT COALESCE(MAX(position), -1) as m FROM subtasks WHERE todo_id = ?')
        .get(todoId) as { m: number }
    ).m;
    const stmt = db.prepare(`
      INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?) RETURNING *
    `);
    return stmt.get(todoId, title, position ?? maxPos + 1) as unknown as Subtask;
  },

  update(id: number, todoId: number, data: { title?: string; completed?: number }): Subtask | undefined {
    const current = db
      .prepare('SELECT * FROM subtasks WHERE id = ? AND todo_id = ?')
      .get(id, todoId) as unknown as Subtask | undefined;
    if (!current) return undefined;

    db.prepare('UPDATE subtasks SET title = ?, completed = ? WHERE id = ? AND todo_id = ?').run(
      data.title ?? current.title,
      data.completed ?? current.completed,
      id,
      todoId,
    );
    return db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as unknown as Subtask;
  },

  delete(id: number, todoId: number): boolean {
    const result = db
      .prepare('DELETE FROM subtasks WHERE id = ? AND todo_id = ?')
      .run(id, todoId);
    return result.changes > 0;
  },
};

// ─── Tag DB ──────────────────────────────────────────────────────────────────

export const tagDB = {
  findAllByUser(userId: number): Tag[] {
    return db
      .prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name')
      .all(userId) as unknown[] as Tag[];
  },

  findById(id: number, userId: number): Tag | undefined {
    return db
      .prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?')
      .get(id, userId) as unknown as Tag | undefined;
  },

  findByTodoId(todoId: number): Tag[] {
    return db
      .prepare(
        `SELECT t.* FROM tags t
         INNER JOIN todo_tags tt ON tt.tag_id = t.id
         WHERE tt.todo_id = ?
         ORDER BY t.name`,
      )
      .all(todoId) as unknown[] as Tag[];
  },

  create(userId: number, input: CreateTagInput): Tag {
    const stmt = db.prepare(`
      INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?) RETURNING *
    `);
    return stmt.get(userId, input.name.trim(), input.color ?? '#3B82F6') as unknown as Tag;
  },

  update(id: number, userId: number, input: UpdateTagInput): Tag | undefined {
    const current = this.findById(id, userId);
    if (!current) return undefined;

    db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?').run(
      input.name?.trim() ?? current.name,
      input.color ?? current.color,
      id,
      userId,
    );
    return this.findById(id, userId);
  },

  delete(id: number, userId: number): boolean {
    const result = db
      .prepare('DELETE FROM tags WHERE id = ? AND user_id = ?')
      .run(id, userId);
    return result.changes > 0;
  },

  attachToTodo(todoId: number, tagId: number, userId: number): void {
    // Verify the tag belongs to the user before attaching
    const tag = this.findById(tagId, userId);
    if (!tag) throw new Error('Tag not found');

    try {
      db.prepare('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
    } catch {
      // Duplicate PK — idempotent no-op
    }
  },

  detachFromTodo(todoId: number, tagId: number, userId: number): void {
    // Verify the tag belongs to the user
    const tag = this.findById(tagId, userId);
    if (!tag) throw new Error('Tag not found');

    db.prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?').run(todoId, tagId);
  },
};

export default db;
