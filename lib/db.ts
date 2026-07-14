import Database from 'better-sqlite3';

import { formatSingaporeDateTime, getSingaporeNow } from '@/lib/timezone';

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
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
  tags: string[];
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string | null;
  subtasks: Subtask[];
}

export interface CreateTodoInput {
  user_id: number;
  title: string;
  due_date?: string | null;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
  tags?: string[];
  completed?: boolean;
}

export interface UpdateTodoInput extends Partial<CreateTodoInput> {
  completed?: boolean;
}

export interface CreateSubtaskInput {
  title: string;
}

export interface UpdateSubtaskInput {
  title?: string;
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
  tags: string;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string | null;
}

interface SubtaskRow {
  id: number;
  todo_id: number;
  title: string;
  completed: number;
  position: number;
  created_at: string;
}

const db = new Database(':memory:');

db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    name TEXT
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
    tags TEXT NOT NULL DEFAULT '[]',
    last_notification_sent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
  CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
`);

function rowToSubtask(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    todo_id: row.todo_id,
    title: row.title,
    completed: row.completed === 1,
    position: row.position,
    created_at: row.created_at,
  };
}

function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    completed: row.completed === 1,
    due_date: row.due_date,
    priority: row.priority,
    is_recurring: row.is_recurring === 1,
    recurrence_pattern: row.recurrence_pattern,
    reminder_minutes: row.reminder_minutes,
    tags: parseTags(row.tags),
    last_notification_sent: row.last_notification_sent,
    created_at: row.created_at,
    updated_at: row.updated_at,
    subtasks: subtaskDB.findByTodoId(row.id),
  };
}

function parseTags(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function buildUpdateParts(input: UpdateTodoInput): { clause: string; values: unknown[] } {
  const parts: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    parts.push('title = ?');
    values.push(input.title);
  }

  if (input.completed !== undefined) {
    parts.push('completed = ?');
    values.push(input.completed ? 1 : 0);
  }

  if (input.due_date !== undefined) {
    parts.push('due_date = ?');
    values.push(input.due_date);
  }

  if (input.priority !== undefined) {
    parts.push('priority = ?');
    values.push(input.priority);
  }

  if (input.is_recurring !== undefined) {
    parts.push('is_recurring = ?');
    values.push(input.is_recurring ? 1 : 0);
  }

  if (input.recurrence_pattern !== undefined) {
    parts.push('recurrence_pattern = ?');
    values.push(input.recurrence_pattern);
  }

  if (input.reminder_minutes !== undefined) {
    parts.push('reminder_minutes = ?');
    values.push(input.reminder_minutes);
  }

  if (input.tags !== undefined) {
    parts.push('tags = ?');
    values.push(JSON.stringify(input.tags));
  }

  parts.push('updated_at = ?');
  values.push(formatSingaporeDateTime(getSingaporeNow()));

  return {
    clause: parts.join(', '),
    values,
  };
}

export const subtaskDB = {
  findById(id: number): Subtask | null {
    const row = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as SubtaskRow | undefined;
    return row ? rowToSubtask(row) : null;
  },

  findByTodoId(todoId: number): Subtask[] {
    const rows = db.prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC, id ASC').all(todoId) as SubtaskRow[];
    return rows.map(rowToSubtask);
  },

  create(todoId: number, data: CreateSubtaskInput): Subtask {
    const title = data.title.trim();
    const nextPositionRow = db
      .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM subtasks WHERE todo_id = ?')
      .get(todoId) as { next_position: number };

    const createdAt = formatSingaporeDateTime(getSingaporeNow());

    const result = db
      .prepare(
        'INSERT INTO subtasks (todo_id, title, completed, position, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(todoId, title, 0, nextPositionRow.next_position, createdAt);

    return this.findById(Number(result.lastInsertRowid)) as Subtask;
  },

  update(id: number, data: UpdateSubtaskInput): Subtask {
    const parts: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) {
      parts.push('title = ?');
      values.push(data.title.trim());
    }

    if (data.completed !== undefined) {
      parts.push('completed = ?');
      values.push(data.completed ? 1 : 0);
    }

    if (parts.length > 0) {
      db.prepare(`UPDATE subtasks SET ${parts.join(', ')} WHERE id = ?`).run(...values, id);
    }

    const updated = this.findById(id);
    if (!updated) {
      throw new Error('Subtask not found');
    }

    return updated;
  },

  delete(id: number): void {
    db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
  },
};

export const todoDB = {
  findById(id: number): Todo | null {
    const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
    return row ? rowToTodo(row) : null;
  },

  findAllByUser(userId: number): Todo[] {
    const rows = db
      .prepare(
        `SELECT *
         FROM todos
         WHERE user_id = ?
         ORDER BY completed ASC, due_date IS NULL ASC, due_date ASC, created_at DESC, id DESC`,
      )
      .all(userId) as TodoRow[];

    return rows.map(rowToTodo);
  },

  create(input: CreateTodoInput): Todo {
    const createdAt = formatSingaporeDateTime(getSingaporeNow());
    const result = db
      .prepare(
        `INSERT INTO todos (
          user_id,
          title,
          completed,
          due_date,
          priority,
          is_recurring,
          recurrence_pattern,
          reminder_minutes,
          tags,
          last_notification_sent,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.user_id,
        input.title.trim(),
        input.completed ? 1 : 0,
        input.due_date ?? null,
        input.priority ?? 'medium',
        input.is_recurring ? 1 : 0,
        input.recurrence_pattern ?? null,
        input.reminder_minutes ?? null,
        JSON.stringify(input.tags ?? []),
        null,
        createdAt,
        null,
      );

    const created = this.findById(Number(result.lastInsertRowid));
    if (!created) {
      throw new Error('Todo not found after create');
    }

    return created;
  },

  update(id: number, input: UpdateTodoInput): Todo {
    const updateParts = buildUpdateParts(input);
    db.prepare(`UPDATE todos SET ${updateParts.clause} WHERE id = ?`).run(...updateParts.values, id);

    const updated = this.findById(id);
    if (!updated) {
      throw new Error('Todo not found');
    }

    return updated;
  },

  delete(id: number): void {
    db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  },
};

export { db };