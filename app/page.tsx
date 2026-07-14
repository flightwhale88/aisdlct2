'use client';

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { CreateTodoInput, Priority, Tag, Todo } from '@/lib/db';
import {
  applyFilters,
  DEFAULT_FILTER_STATE,
  FilterState,
  hasActiveFilters,
} from '@/lib/filters';
import {
  createPreset,
  deletePreset,
  FilterPreset,
  loadPresets,
  savePreset,
} from '@/lib/filterPresets';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { sectionTodos } from '@/lib/todoSort';
import { formatSingaporeDate, getSingaporeNow } from '@/lib/timezone';

const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_BADGE_STYLES: Record<Priority, CSSProperties> = {
  high: {
    background: '#FEE2E2',
    border: '1px solid #EF4444',
    color: '#991B1B',
  },
  medium: {
    background: '#FEF3C7',
    border: '1px solid #F59E0B',
    color: '#92400E',
  },
  low: {
    background: '#DBEAFE',
    border: '1px solid #3B82F6',
    color: '#1E3A8A',
  },
};

type EditableTodo = {
  id: number;
  title: string;
  priority: Priority;
  dueDateLocal: string;
};

function toDateTimeLocalValue(isoDate: string | null): string {
  if (!isoDate) {
    return '';
  }

  const date = new Date(isoDate);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';

  return `${lookup('year')}-${lookup('month')}-${lookup('day')}T${lookup('hour')}:${lookup('minute')}`;
}

function toIsoOrNull(dateTimeLocal: string): string | null {
  if (!dateTimeLocal) {
    return null;
  }

  const parsed = new Date(dateTimeLocal);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sectionStyle(color: string): CSSProperties {
  return {
    border: `1px solid ${color}`,
    borderRadius: 14,
    background: '#fff',
    padding: 16,
    boxShadow: '0 8px 30px rgba(16, 24, 40, 0.08)',
  };
}

function buildFilterPreview(filters: FilterState, tags: Tag[]): string {
  const parts: string[] = [];
  if (filters.search.trim()) {
    parts.push(`Search: "${filters.search.trim()}"`);
  }
  if (filters.priority !== 'all') {
    parts.push(`Priority: ${PRIORITY_LABELS[filters.priority]}`);
  }
  if (filters.tagId !== 'all') {
    const tag = tags.find((item) => item.id === filters.tagId);
    parts.push(`Tag: ${tag ? tag.name : 'Unknown'}`);
  }
  if (filters.completion !== 'all') {
    parts.push(`Completion: ${filters.completion}`);
  }
  if (filters.dueDateFrom || filters.dueDateTo) {
    parts.push(`Date: ${filters.dueDateFrom ?? '...'} to ${filters.dueDateTo ?? '...'}`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'No active filters';
}

export default function TodoPage(): ReactElement {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDateLocal, setDueDateLocal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTodo, setEditingTodo] = useState<EditableTodo | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }
    return loadPresets();
  });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadTodos(): Promise<void> {
      try {
        const response = await fetch('/api/todos');
        if (!response.ok) {
          throw new Error('Failed to load todos');
        }
        const data = (await response.json()) as Todo[];
        if (isMounted) {
          setTodos(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load todos');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTodos();
    return () => {
      isMounted = false;
    };
  }, []);

  const availableTags = useMemo(() => {
    const map = new Map<number, Tag>();
    todos.forEach((todo) => {
      (todo.tags ?? []).forEach((tag) => {
        map.set(tag.id, tag);
      });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [todos]);

  const effectiveTagId = useMemo(() => {
    if (filters.tagId === 'all') {
      return 'all' as const;
    }
    return availableTags.some((tag) => tag.id === filters.tagId)
      ? filters.tagId
      : ('all' as const);
  }, [availableTags, filters.tagId]);

  const debouncedSearch = useDebounce(filters.search, 300);
  const activeFilterState = useMemo(
    () => ({
      ...filters,
      search: filters.search.trim() ? debouncedSearch : '',
      tagId: effectiveTagId,
    }),
    [filters, debouncedSearch, effectiveTagId]
  );

  const filteredTodos = useMemo(() => applyFilters(todos, activeFilterState), [todos, activeFilterState]);
  const sections = useMemo(() => sectionTodos(filteredTodos, getSingaporeNow()), [filteredTodos]);
  const hasFilters = hasActiveFilters(filters);
  const hasAnyTodos = todos.length > 0;

  async function createTodo(input: CreateTodoInput): Promise<void> {
    const tempTodo: Todo = {
      id: -Date.now(),
      user_id: 0,
      title: input.title,
      completed: false,
      due_date: input.due_date ?? null,
      priority: input.priority ?? 'medium',
      is_recurring: false,
      recurrence_pattern: null,
      reminder_minutes: null,
      last_notification_sent: null,
      created_at: new Date().toISOString(),
      updated_at: null,
    };

    setTodos((previousTodos) => [...previousTodos, tempTodo]);

    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input.title,
          priority: input.priority,
          due_date: input.due_date,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Could not create todo');
      }

      const savedTodo = (await response.json()) as Todo;
      setTodos((previousTodos) =>
        previousTodos.map((todo) => (todo.id === tempTodo.id ? savedTodo : todo))
      );
    } catch (createError) {
      setTodos((previousTodos) => previousTodos.filter((todo) => todo.id !== tempTodo.id));
      setError(createError instanceof Error ? createError.message : 'Could not create todo');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      return;
    }

    const dueDateIso = toIsoOrNull(dueDateLocal);
    if (dueDateLocal && !dueDateIso) {
      setError('Due date is invalid');
      return;
    }

    await createTodo({
      user_id: 1,
      title: trimmed,
      priority,
      due_date: dueDateIso,
    });

    setTitle('');
    setPriority('medium');
    setDueDateLocal('');
  }

  async function handleToggle(todoId: number, completed: boolean): Promise<void> {
    const previousTodos = todos;
    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              completed,
              updated_at: new Date().toISOString(),
            }
          : todo
      )
    );

    try {
      const response = await fetch(`/api/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Could not update todo');
      }

      const updatedTodo = (await response.json()) as Todo;
      setTodos((currentTodos) =>
        currentTodos.map((todo) => (todo.id === todoId ? updatedTodo : todo))
      );
    } catch (updateError) {
      setTodos(previousTodos);
      setError(updateError instanceof Error ? updateError.message : 'Could not update todo');
    }
  }

  async function handleDelete(todoId: number): Promise<void> {
    const previousTodos = todos;
    setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== todoId));

    try {
      const response = await fetch(`/api/todos/${todoId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'Could not delete todo');
      }
    } catch (deleteError) {
      setTodos(previousTodos);
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete todo');
    }
  }

  function openEditModal(todo: Todo): void {
    setEditingTodo({
      id: todo.id,
      title: todo.title,
      priority: todo.priority,
      dueDateLocal: toDateTimeLocalValue(todo.due_date),
    });
  }

  function closeEditModal(): void {
    setEditingTodo(null);
  }

  async function submitEdit(): Promise<void> {
    if (!editingTodo) {
      return;
    }

    const trimmedTitle = editingTodo.title.trim();
    if (!trimmedTitle) {
      setError('Title cannot be empty');
      return;
    }

    const dueDateIso = toIsoOrNull(editingTodo.dueDateLocal);
    if (editingTodo.dueDateLocal && !dueDateIso) {
      setError('Due date is invalid');
      return;
    }

    try {
      const response = await fetch(`/api/todos/${editingTodo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          priority: editingTodo.priority,
          due_date: dueDateIso,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? 'Could not update todo');
        return;
      }

      const updatedTodo = (await response.json()) as Todo;
      setTodos((currentTodos) =>
        currentTodos.map((todo) => (todo.id === updatedTodo.id ? updatedTodo : todo))
      );
      closeEditModal();
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'Could not update todo');
    }
  }

  function onModalKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      closeEditModal();
    }
  }

  function clearAllFilters(): void {
    setFilters(DEFAULT_FILTER_STATE);
  }

  function saveCurrentFilterPreset(): void {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      setError('Preset name is required');
      return;
    }

    const nextPreset = createPreset(trimmedName, filters);
    const result = savePreset(nextPreset);
    setPresets(result.presets);
    setShowSaveModal(false);
    setPresetName('');

    if (result.error) {
      setError(result.error);
    }
  }

  function applyPreset(filtersFromPreset: FilterState): void {
    const tagStillExists =
      filtersFromPreset.tagId === 'all' ||
      availableTags.some((tag) => tag.id === filtersFromPreset.tagId);

    setFilters({
      ...DEFAULT_FILTER_STATE,
      ...filtersFromPreset,
      tagId: tagStillExists ? filtersFromPreset.tagId : 'all',
    });
  }

  function removePreset(preset: FilterPreset): void {
    const confirmed = window.confirm(`Delete preset "${preset.name}"?`);
    if (!confirmed) {
      return;
    }

    setPresets(deletePreset(preset.id));
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '2rem 1rem',
        background:
          'radial-gradient(circle at 5% 0%, #fcd9df 0%, #f6f7fb 42%, #dfe9ff 100%)',
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <h1 style={{ fontSize: '2.2rem', marginTop: 0, marginBottom: 8 }}>Todo Search & Filtering</h1>
        <p style={{ marginTop: 0, color: '#5c6170' }}>
          Real-time search, quick filters, advanced filters, and saved presets.
        </p>

        <div
          style={{
            display: 'grid',
            gap: 10,
            background: '#fff',
            borderRadius: 14,
            padding: 14,
            boxShadow: '0 8px 30px rgba(16, 24, 40, 0.08)',
            marginBottom: 16,
          }}
        >
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: 10, color: '#98A2B3' }}>🔍</span>
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Search todos and subtasks..."
              style={{
                width: '100%',
                border: '1px solid #d0d5dd',
                borderRadius: 10,
                padding: '10px 36px 10px 34px',
              }}
            />
            {filters.search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    search: '',
                  }))
                }
                style={{
                  position: 'absolute',
                  right: 10,
                  top: 8,
                  border: 'none',
                  background: 'transparent',
                  color: '#667085',
                  cursor: 'pointer',
                  fontSize: 18,
                }}
              >
                ✕
              </button>
            ) : null}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <select
              value={filters.priority}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  priority: event.target.value as FilterState['priority'],
                }))
              }
              aria-label="Priority filter"
              style={{ border: '1px solid #d0d5dd', borderRadius: 10, padding: '10px 12px' }}
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            <select
              value={effectiveTagId}
              onChange={(event) => {
                const value = event.target.value;
                setFilters((current) => ({
                  ...current,
                  tagId: value === 'all' ? 'all' : Number(value),
                }));
              }}
              aria-label="Tag filter"
              style={{ border: '1px solid #d0d5dd', borderRadius: 10, padding: '10px 12px' }}
            >
              <option value="all">All Tags</option>
              {availableTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setAdvancedOpen((current) => !current)}
              style={{
                border: 'none',
                borderRadius: 10,
                padding: '10px 12px',
                background: advancedOpen ? '#3B82F6' : '#EAECF0',
                color: advancedOpen ? '#fff' : '#344054',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {advancedOpen ? '▼ Advanced' : '▶ Advanced'}
            </button>
          </div>

          {advancedOpen ? (
            <div
              style={{
                marginTop: 2,
                border: '1px solid #BFDBFE',
                background: '#EFF6FF',
                borderRadius: 10,
                padding: 10,
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: 10 }}>
                <select
                  value={filters.completion}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      completion: event.target.value as FilterState['completion'],
                    }))
                  }
                  aria-label="Completion status"
                  style={{ border: '1px solid #d0d5dd', borderRadius: 10, padding: '10px 12px' }}
                >
                  <option value="all">All Todos</option>
                  <option value="incomplete">Incomplete Only</option>
                  <option value="completed">Completed Only</option>
                </select>

                <input
                  type="date"
                  value={filters.dueDateFrom ?? ''}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      dueDateFrom: event.target.value || null,
                    }))
                  }
                  aria-label="Due date from"
                  style={{ border: '1px solid #d0d5dd', borderRadius: 10, padding: '10px 12px' }}
                />
                <input
                  type="date"
                  value={filters.dueDateTo ?? ''}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      dueDateTo: event.target.value || null,
                    }))
                  }
                  aria-label="Due date to"
                  style={{ border: '1px solid #d0d5dd', borderRadius: 10, padding: '10px 12px' }}
                />
              </div>

              {presets.length > 0 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {presets.map((preset) => (
                    <span
                      key={preset.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        border: '1px solid #d0d5dd',
                        borderRadius: 999,
                        padding: '5px 10px',
                        gap: 6,
                        background: '#fff',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => applyPreset(preset.filters)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                      >
                        {preset.name}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete preset ${preset.name}`}
                        onClick={() => removePreset(preset)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#98A2B3',
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {hasFilters ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  border: 'none',
                  borderRadius: 8,
                  background: '#FEF3F2',
                  color: '#B42318',
                  padding: '8px 10px',
                  cursor: 'pointer',
                }}
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={() => setShowSaveModal(true)}
                style={{
                  border: 'none',
                  borderRadius: 8,
                  background: '#ECFDF3',
                  color: '#027A48',
                  padding: '8px 10px',
                  cursor: 'pointer',
                }}
              >
                💾 Save Filter
              </button>
            </div>
          ) : null}
        </div>

        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 160px 220px auto',
            gap: 10,
            background: '#fff',
            borderRadius: 14,
            padding: 14,
            boxShadow: '0 8px 30px rgba(16, 24, 40, 0.08)',
            marginBottom: 16,
          }}
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a todo..."
            aria-label="Todo title"
            style={{ border: '1px solid #d0d5dd', borderRadius: 10, padding: '10px 12px' }}
          />
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
            aria-label="Priority"
            style={{ border: '1px solid #d0d5dd', borderRadius: 10, padding: '10px 12px' }}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input
            type="datetime-local"
            value={dueDateLocal}
            onChange={(event) => setDueDateLocal(event.target.value)}
            aria-label="Due date"
            style={{ border: '1px solid #d0d5dd', borderRadius: 10, padding: '10px 12px' }}
          />
          <button
            type="submit"
            disabled={!title.trim()}
            style={{
              border: 'none',
              borderRadius: 10,
              padding: '10px 12px',
              background: '#1d4ed8',
              color: '#fff',
              fontWeight: 700,
              cursor: title.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Add
          </button>
        </form>

        {error ? (
          <p
            style={{
              borderRadius: 10,
              background: '#fee4e2',
              color: '#b42318',
              padding: '10px 12px',
              marginTop: 0,
            }}
          >
            {error}
          </p>
        ) : null}

        {isLoading ? <p>Loading todos...</p> : null}

        {!isLoading && !hasAnyTodos ? (
          <div style={{ ...sectionStyle('#98A2B3'), color: '#475467' }}>You have no todos yet.</div>
        ) : null}

        {!isLoading && hasAnyTodos && filteredTodos.length === 0 ? (
          <div style={{ ...sectionStyle('#98A2B3'), color: '#475467' }}>No todos match your filters.</div>
        ) : null}

        <div style={{ display: 'grid', gap: 14 }}>
          {[
            { key: 'overdue', label: 'Overdue', color: '#f04438', items: sections.overdue },
            { key: 'pending', label: 'Pending', color: '#667085', items: sections.pending },
            { key: 'completed', label: 'Completed', color: '#12b76a', items: sections.completed },
          ]
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <section key={section.key} style={sectionStyle(section.color)}>
                <h2 style={{ marginTop: 0, marginBottom: 12, color: section.color }}>
                  {section.label} ({section.items.length})
                </h2>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
                  {section.items.map((todo) => (
                    <li
                      key={todo.id}
                      style={{
                        border: '1px solid #e4e7ec',
                        borderRadius: 12,
                        padding: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={todo.completed}
                          onChange={(event) => {
                            void handleToggle(todo.id, event.target.checked);
                          }}
                          aria-label={`Toggle ${todo.title}`}
                        />
                        <div>
                          <p
                            style={{
                              margin: 0,
                              textDecoration: todo.completed ? 'line-through' : 'none',
                              fontWeight: 600,
                            }}
                          >
                            {todo.title}
                          </p>
                          <p style={{ margin: '4px 0 0', color: '#667085', fontSize: 13 }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 700,
                                padding: '2px 8px',
                                ...PRIORITY_BADGE_STYLES[todo.priority],
                              }}
                            >
                              {PRIORITY_LABELS[todo.priority]}
                            </span>
                            {todo.due_date ? ` • Due ${formatSingaporeDate(todo.due_date)}` : ''}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => openEditModal(todo)}
                          style={{
                            borderRadius: 8,
                            border: '1px solid #d0d5dd',
                            padding: '6px 10px',
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDelete(todo.id);
                          }}
                          style={{
                            borderRadius: 8,
                            border: '1px solid #f04438',
                            padding: '6px 10px',
                            background: '#fff5f5',
                            color: '#b42318',
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      </div>

      {showSaveModal ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setShowSaveModal(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setShowSaveModal(false);
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(16, 24, 40, 0.4)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(560px, 94vw)',
              borderRadius: 14,
              background: '#fff',
              padding: 16,
              boxShadow: '0 18px 60px rgba(16, 24, 40, 0.35)',
              display: 'grid',
              gap: 10,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>Save Filter Preset</h3>
            <p style={{ margin: 0, color: '#667085' }}>{buildFilterPreview(filters, availableTags)}</p>
            <input
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="Preset name"
              aria-label="Preset name"
              style={{ border: '1px solid #d0d5dd', borderRadius: 10, padding: '10px 12px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                style={{
                  borderRadius: 8,
                  border: '1px solid #d0d5dd',
                  padding: '8px 12px',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCurrentFilterPreset}
                style={{
                  borderRadius: 8,
                  border: 'none',
                  padding: '8px 12px',
                  background: '#16A34A',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingTodo ? (
        <div
          role="button"
          tabIndex={0}
          onClick={closeEditModal}
          onKeyDown={onModalKeyDown}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(16, 24, 40, 0.4)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(520px, 94vw)',
              borderRadius: 14,
              background: '#fff',
              padding: 16,
              boxShadow: '0 18px 60px rgba(16, 24, 40, 0.35)',
              display: 'grid',
              gap: 10,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>Edit Todo</h3>
            <input
              value={editingTodo.title}
              onChange={(event) =>
                setEditingTodo((current) =>
                  current
                    ? {
                        ...current,
                        title: event.target.value,
                      }
                    : null
                )
              }
              aria-label="Edit title"
              style={{ border: '1px solid #d0d5dd', borderRadius: 10, padding: '10px 12px' }}
            />
            <select
              value={editingTodo.priority}
              onChange={(event) =>
                setEditingTodo((current) =>
                  current
                    ? {
                        ...current,
                        priority: event.target.value as Priority,
                      }
                    : null
                )
              }
              aria-label="Edit priority"
              style={{ border: '1px solid #d0d5dd', borderRadius: 10, padding: '10px 12px' }}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input
              type="datetime-local"
              value={editingTodo.dueDateLocal}
              onChange={(event) =>
                setEditingTodo((current) =>
                  current
                    ? {
                        ...current,
                        dueDateLocal: event.target.value,
                      }
                    : null
                )
              }
              aria-label="Edit due date"
              style={{ border: '1px solid #d0d5dd', borderRadius: 10, padding: '10px 12px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'end', gap: 8 }}>
              <button
                type="button"
                onClick={closeEditModal}
                style={{
                  borderRadius: 8,
                  border: '1px solid #d0d5dd',
                  padding: '8px 12px',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitEdit();
                }}
                style={{
                  borderRadius: 8,
                  border: 'none',
                  padding: '8px 12px',
                  background: '#1d4ed8',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
