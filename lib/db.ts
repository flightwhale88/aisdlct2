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
    description TEXT,
    category TEXT,
    title_template TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_pattern TEXT,
    reminder_minutes INTEGER,
    due_date_offset_minutes INTEGER,
    subtasks_json TEXT,
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

export const PRIORITY_VALUES: Priority[] = ['high', 'medium', 'low'];

export const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function validatePriority(value: unknown): Priority {
  if (value === undefined || value === null) return 'medium';
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  throw new Error(`Invalid priority: ${String(value)}. Must be 'high', 'medium', or 'low'.`);
}

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
  description: string | null;
  category: string | null;
  title_template: string;
  priority: Priority;
  is_recurring: number;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  due_date_offset_minutes: number | null;
  subtasks_json: string | null;
  created_at: string;
}

export interface Holiday {
  id: number;
  date: string; // YYYY-MM-DD
  name: string;
  created_at: string;
}

export interface TemplateSubtask {
  title: string;
  position: number;
}

export interface CreateTemplateInput {
  user_id: number;
  name: string;
  description?: string | null;
  category?: string | null;
  title_template: string;
  priority: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
  due_date_offset_minutes?: number | null;
  subtasks_json?: string | null;
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

  importAll(
    userId: number,
    items: Array<{
      title: string;
      completed: boolean;
      due_date: string | null;
      priority: string;
      is_recurring?: boolean;
      recurrence_pattern: string | null;
      reminder_minutes: number | null;
      created_at: string;
      subtasks: Array<{ title: string; completed: boolean; position: number }>;
      tags: Array<{ name: string; color: string }>;
    }>,
  ): { imported: number; tagsCreated: number; tagsReused: number } {
    let tagsCreated = 0;
    let tagsReused = 0;

    const insertTodo = db.prepare(`
      INSERT INTO todos (user_id, title, completed, due_date, priority, recurrence, reminder_minutes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    const insertSubtask = db.prepare(
      'INSERT INTO subtasks (todo_id, title, completed, position) VALUES (?, ?, ?, ?)',
    );
    const findTag = db.prepare('SELECT id FROM tags WHERE user_id = ? AND LOWER(name) = LOWER(?)');
    const insertTag = db.prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?) RETURNING id');
    const linkTag = db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');

    db.exec('BEGIN');
    try {
      for (const item of items) {
        const todoResult = insertTodo.run(
          userId, item.title, item.completed ? 1 : 0, item.due_date ?? null,
          item.priority, item.recurrence_pattern ?? null, item.reminder_minutes ?? null, item.created_at,
        );
        const todoId = todoResult.lastInsertRowid as number;

        item.subtasks.forEach((s, i) => {
          insertSubtask.run(todoId, s.title, s.completed ? 1 : 0, s.position ?? i);
        });

        for (const tag of item.tags) {
          const existing = findTag.get(userId, tag.name) as { id: number } | undefined;
          let tagId: number;
          if (existing) {
            tagsReused++;
            tagId = existing.id;
          } else {
            tagsCreated++;
            const row = insertTag.get(userId, tag.name, tag.color) as unknown as { id: number };
            tagId = row.id;
          }
          linkTag.run(todoId, tagId);
        }
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return { imported: items.length, tagsCreated, tagsReused };
  },
};

// ─── Subtask DB ──────────────────────────────────────────────────────────────

export const subtaskDB = {
  findById(id: number): Subtask | undefined {
    return db
      .prepare('SELECT * FROM subtasks WHERE id = ?')
      .get(id) as unknown as Subtask | undefined;
  },

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

// ─── Templates migration (old schema → PRP-07 schema) ────────────────────────
// If the table was created with the old column names, recreate it.
try {
  db.exec('SELECT title_template FROM templates LIMIT 1');
} catch {
  db.exec(`
    DROP TABLE IF EXISTS templates;
    CREATE TABLE templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      title_template TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_pattern TEXT,
      reminder_minutes INTEGER,
      due_date_offset_minutes INTEGER,
      subtasks_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
  `);
}

// ─── Template DB ──────────────────────────────────────────────────────────────

export const templateDB = {
  findAllByUser(userId: number): Template[] {
    return db
      .prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY name')
      .all(userId) as unknown[] as Template[];
  },

  findById(id: number): Template | undefined {
    return db
      .prepare('SELECT * FROM templates WHERE id = ?')
      .get(id) as unknown as Template | undefined;
  },

  create(input: CreateTemplateInput): Template {
    return db
      .prepare(`
        INSERT INTO templates
          (user_id, name, description, category, title_template, priority,
           is_recurring, recurrence_pattern, reminder_minutes,
           due_date_offset_minutes, subtasks_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `)
      .get(
        input.user_id,
        input.name.trim(),
        input.description ?? null,
        input.category ?? null,
        input.title_template.trim(),
        input.priority ?? 'medium',
        input.is_recurring ? 1 : 0,
        input.recurrence_pattern ?? null,
        input.reminder_minutes ?? null,
        input.due_date_offset_minutes ?? null,
        input.subtasks_json ?? null,
      ) as unknown as Template;
  },

  update(id: number, userId: number, input: Partial<CreateTemplateInput>): Template | undefined {
    const current = db
      .prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?')
      .get(id, userId) as unknown as Template | undefined;
    if (!current) return undefined;

    db.prepare(`
      UPDATE templates
      SET name = ?, description = ?, category = ?, title_template = ?,
          priority = ?, is_recurring = ?, recurrence_pattern = ?,
          reminder_minutes = ?, due_date_offset_minutes = ?, subtasks_json = ?
      WHERE id = ? AND user_id = ?
    `).run(
      input.name?.trim() ?? current.name,
      input.description !== undefined ? input.description : current.description,
      input.category !== undefined ? input.category : current.category,
      input.title_template?.trim() ?? current.title_template,
      input.priority ?? current.priority,
      input.is_recurring !== undefined ? (input.is_recurring ? 1 : 0) : current.is_recurring,
      input.recurrence_pattern !== undefined ? input.recurrence_pattern : current.recurrence_pattern,
      input.reminder_minutes !== undefined ? input.reminder_minutes : current.reminder_minutes,
      input.due_date_offset_minutes !== undefined ? input.due_date_offset_minutes : current.due_date_offset_minutes,
      input.subtasks_json !== undefined ? input.subtasks_json : current.subtasks_json,
      id,
      userId,
    );
    return this.findById(id);
  },

  delete(id: number, userId: number): boolean {
    const result = db
      .prepare('DELETE FROM templates WHERE id = ? AND user_id = ?')
      .run(id, userId);
    return (result.changes as number) > 0;
  },
};

// ─── Holiday DB ───────────────────────────────────────────────────────────────

export const holidayDB = {
  findAll(): Holiday[] {
    return db.prepare('SELECT * FROM holidays ORDER BY date').all() as unknown[] as Holiday[];
  },

  findByMonth(year: number, month: number): Holiday[] {
    // Include a few days padding for leading/trailing grid cells
    const padded = new Date(Date.UTC(year, month, 10)); // next month + 10 days
    const end = padded.toISOString().slice(0, 10);
    return db
      .prepare('SELECT * FROM holidays WHERE date >= ? AND date <= ? ORDER BY date')
      .all(
        // Go back 7 days from start for leading cells
        new Date(Date.UTC(year, month - 1, -6)).toISOString().slice(0, 10),
        end,
      ) as unknown[] as Holiday[];
  },

  upsert(date: string, name: string): void {
    db.prepare(
      'INSERT INTO holidays (date, name) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET name = excluded.name',
    ).run(date, name);
  },
};

export default db;
