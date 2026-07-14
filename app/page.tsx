'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { useNotifications } from '@/lib/hooks/useNotifications';
import { REMINDER_LABELS, type ReminderMinutes } from '@/lib/reminders';
import { formatSingaporeDateTime, parseSingaporeDateTime } from '@/lib/timezone';

type Priority = 'high' | 'medium' | 'low';

type Todo = {
  id: number;
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: Priority;
  is_recurring: boolean;
  reminder_minutes: ReminderMinutes | null;
};

type TodoFormState = {
  title: string;
  dueDate: string;
  priority: Priority;
  reminderMinutes: ReminderMinutes | '';
};

const REMINDER_OPTIONS: ReminderMinutes[] = [15, 30, 60, 120, 1440, 2880, 10080];
const PRIORITY_OPTIONS: Priority[] = ['high', 'medium', 'low'];

function emptyForm(): TodoFormState {
  return {
    title: '',
    dueDate: '',
    priority: 'medium',
    reminderMinutes: '',
  };
}

function formatDueDate(value: string | null): string {
  if (!value) {
    return 'No due date';
  }

  const parsed = parseSingaporeDateTime(value);
  return parsed ? formatSingaporeDateTime(parsed) : value;
}

function toEditableDate(value: string | null): string {
  return value ? value.slice(0, 16) : '';
}

export default function HomePage() {
  const { permission, requestPermission, supported } = useNotifications();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TodoFormState>(emptyForm());

  const isEditing = editingId !== null;
  const notificationEnabled = permission === 'granted';

  useEffect(() => {
    void refreshTodos();
  }, []);

  const sortedTodos = useMemo(
    () => [...todos].sort((left, right) => Number(left.completed) - Number(right.completed)),
    [todos],
  );

  async function refreshTodos(): Promise<void> {
    setLoading(true);
    setStatus('');

    try {
      const response = await fetch('/api/todos', { cache: 'no-store' });
      if (response.status === 401) {
        setTodos([]);
        setStatus('Sign in to view and edit todos.');
        return;
      }

      if (!response.ok) {
        setStatus('Unable to load todos right now.');
        return;
      }

      const payload = (await response.json()) as Todo[];
      setTodos(payload);
    } catch {
      setStatus('Unable to load todos right now.');
    } finally {
      setLoading(false);
    }
  }

  function beginEdit(todo: Todo): void {
    setEditingId(todo.id);
    setForm({
      title: todo.title,
      dueDate: toEditableDate(todo.due_date),
      priority: todo.priority,
      reminderMinutes: todo.reminder_minutes === null ? '' : todo.reminder_minutes,
    });
    setStatus(`Editing “${todo.title}”.`);
  }

  function cancelEdit(): void {
    setEditingId(null);
    setForm(emptyForm());
    setStatus('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!form.title.trim()) {
      setStatus('Title is required.');
      return;
    }

    setSaving(true);
    setStatus('');

    const payload = {
      title: form.title.trim(),
      due_date: form.dueDate.trim() ? form.dueDate.trim() : null,
      priority: form.priority,
      reminder_minutes: form.reminderMinutes === '' ? null : form.reminderMinutes,
    };

    try {
      const response = await fetch(editingId ? `/api/todos/${editingId}` : '/api/todos', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatus(error?.error ?? 'Unable to save the todo.');
        return;
      }

      const message = editingId ? 'Todo updated.' : 'Todo created.';
      cancelEdit();
      await refreshTodos();
      setStatus(message);
    } catch {
      setStatus('Unable to save the todo.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompleted(todo: Todo): Promise<void> {
    const response = await fetch(`/api/todos/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !todo.completed }),
    });

    if (response.ok) {
      await refreshTodos();
    }
  }

  async function removeTodo(todoId: number): Promise<void> {
    const response = await fetch(`/api/todos/${todoId}`, { method: 'DELETE' });
    if (response.ok) {
      await refreshTodos();
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">TaskBoard</p>
          <h1>Todo planning with reminders that quietly keep watch.</h1>
          <p className="lede">
            Set due dates, attach reminder windows, and let the app poll for browser notifications while you keep
            working.
          </p>
        </div>

        <button
          type="button"
          className={`notification-toggle ${notificationEnabled ? 'is-on' : ''}`}
          disabled={!supported || notificationEnabled}
          onClick={() => void requestPermission()}
        >
          {notificationEnabled ? '🔔 Notifications On' : '🔔 Enable Notifications'}
        </button>
      </section>

      {!supported ? <div className="notice">This browser does not support notifications.</div> : null}
      {status ? <div className="notice">{status}</div> : null}

      <section className="workspace">
        <form className="todo-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-grid">
            <label>
              <span>Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current: TodoFormState) => ({ ...current, title: event.target.value }))}
                placeholder="Write a clear todo title"
              />
            </label>

            <label>
              <span>Due date</span>
              <input
                type="datetime-local"
                value={form.dueDate}
                onChange={(event) => setForm((current: TodoFormState) => ({ ...current, dueDate: event.target.value }))}
              />
            </label>

            <label>
              <span>Priority</span>
              <select
                value={form.priority}
                onChange={(event) => setForm((current: TodoFormState) => ({ ...current, priority: event.target.value as Priority }))}
              >
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Reminder</span>
              <select
                value={form.reminderMinutes}
                disabled={!form.dueDate}
                onChange={(event) =>
                  setForm((current: TodoFormState): TodoFormState => ({
                    ...current,
                    reminderMinutes: event.target.value === '' ? '' : (Number(event.target.value) as ReminderMinutes),
                  }))
                }
              >
                <option value="">None</option>
                {REMINDER_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes === 15
                      ? '15 minutes before'
                      : minutes === 30
                        ? '30 minutes before'
                        : minutes === 60
                          ? '1 hour before'
                          : minutes === 120
                            ? '2 hours before'
                            : minutes === 1440
                              ? '1 day before'
                              : minutes === 2880
                                ? '2 days before'
                                : '1 week before'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-actions">
            {isEditing ? (
              <button type="button" className="ghost-button" onClick={cancelEdit}>
                Cancel
              </button>
            ) : null}
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving...' : isEditing ? 'Update todo' : 'Create todo'}
            </button>
          </div>
        </form>

        <div className="todo-list">
          <div className="list-header">
            <h2>Your todos</h2>
            <button type="button" className="ghost-button" onClick={() => void refreshTodos()}>
              Refresh
            </button>
          </div>

          {loading ? <p className="empty-state">Loading todos...</p> : null}
          {!loading && sortedTodos.length === 0 ? <p className="empty-state">No todos yet.</p> : null}

          <ul>
            {sortedTodos.map((todo) => (
              <li key={todo.id} className={`todo-card ${todo.completed ? 'is-complete' : ''}`}>
                <div className="todo-copy">
                  <div className="todo-title-row">
                    <h3>{todo.title}</h3>
                    {todo.reminder_minutes !== null ? (
                      <span className="badge">🔔 {REMINDER_LABELS[todo.reminder_minutes]}</span>
                    ) : null}
                  </div>
                  <p>{formatDueDate(todo.due_date)}</p>
                  <small>
                    Priority: {todo.priority} {todo.is_recurring ? '• recurring' : ''}
                  </small>
                </div>

                <div className="todo-actions">
                  <button type="button" className="ghost-button" onClick={() => void toggleCompleted(todo)}>
                    {todo.completed ? 'Reopen' : 'Complete'}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => beginEdit(todo)}>
                    Edit
                  </button>
                  <button type="button" className="danger-button" onClick={() => void removeTodo(todo.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <style>{`
        .page-shell {
          min-height: 100vh;
          padding: 40px;
          background:
            radial-gradient(circle at top left, rgba(255, 153, 102, 0.24), transparent 28%),
            radial-gradient(circle at top right, rgba(90, 115, 255, 0.18), transparent 26%),
            linear-gradient(180deg, #f9f5ef 0%, #f3efe7 100%);
          color: #1f2937;
        }

        .hero {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: #b45309;
        }

        h1 {
          margin: 0;
          max-width: 14ch;
          font-size: clamp(2.5rem, 5vw, 4.75rem);
          line-height: 0.95;
        }

        .lede {
          max-width: 52ch;
          margin: 16px 0 0;
          font-size: 1.05rem;
          color: #4b5563;
        }

        .workspace {
          display: grid;
          grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
          gap: 24px;
          align-items: start;
        }

        .todo-form,
        .todo-list,
        .notice {
          border: 1px solid rgba(31, 41, 55, 0.08);
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.82);
          box-shadow: 0 22px 48px rgba(31, 41, 55, 0.08);
          backdrop-filter: blur(12px);
        }

        .todo-form {
          padding: 20px;
        }

        .form-grid {
          display: grid;
          gap: 16px;
        }

        label {
          display: grid;
          gap: 8px;
          font-weight: 600;
        }

        label span {
          font-size: 0.95rem;
        }

        input,
        select {
          border: 1px solid rgba(31, 41, 55, 0.14);
          border-radius: 14px;
          padding: 12px 14px;
          font: inherit;
          background: #fff;
        }

        input:disabled,
        select:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .form-actions,
        .todo-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .form-actions {
          margin-top: 18px;
          justify-content: flex-end;
        }

        .todo-list {
          padding: 20px;
        }

        .list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .list-header h2 {
          margin: 0;
          font-size: 1.15rem;
        }

        ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 14px;
        }

        .todo-card {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid rgba(31, 41, 55, 0.08);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(250, 248, 244, 0.96));
        }

        .todo-card.is-complete {
          opacity: 0.72;
        }

        .todo-copy h3 {
          margin: 0;
          font-size: 1.05rem;
        }

        .todo-copy p,
        .todo-copy small {
          margin: 6px 0 0;
          color: #4b5563;
        }

        .todo-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .badge {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 0.82rem;
          background: rgba(245, 158, 11, 0.12);
          color: #b45309;
        }

        .notification-toggle,
        .primary-button,
        .ghost-button,
        .danger-button {
          border: 0;
          border-radius: 999px;
          padding: 12px 16px;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }

        .notification-toggle:hover:not(:disabled),
        .primary-button:hover:not(:disabled),
        .ghost-button:hover:not(:disabled),
        .danger-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .notification-toggle {
          align-self: start;
          background: #f97316;
          color: #fff;
          box-shadow: 0 12px 26px rgba(249, 115, 22, 0.28);
        }

        .notification-toggle.is-on {
          background: #dcfce7;
          color: #166534;
          box-shadow: none;
        }

        .primary-button {
          background: #111827;
          color: #fff;
        }

        .ghost-button {
          background: rgba(17, 24, 39, 0.06);
          color: #111827;
        }

        .danger-button {
          background: rgba(220, 38, 38, 0.12);
          color: #b91c1c;
        }

        .notice,
        .empty-state {
          margin: 0 0 16px;
          padding: 14px 18px;
          border-radius: 18px;
          color: #4b5563;
        }

        .empty-state {
          padding: 10px 0 0;
        }

        @media (max-width: 900px) {
          .hero,
          .workspace,
          .todo-card {
            grid-template-columns: 1fr;
            flex-direction: column;
          }

          .hero {
            align-items: stretch;
          }
        }
      `}</style>
    </main>
  );
}
