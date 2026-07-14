'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { Tag, Todo, Subtask, Priority, Template, CreateTagInput, UpdateTagInput } from '@/lib/db';

// ─── Priority helpers ─────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const PRIORITY_STYLES: Record<Priority, string> = {
  high:   'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700',
  low:    'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700',
};

const PRIORITY_LABELS: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_STYLES[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function compareTodos(a: Todo, b: Todo): number {
  const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (pd !== 0) return pd;
  if (a.due_date && b.due_date) {
    const dd = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (dd !== 0) return dd;
  } else if (a.due_date) return -1;
  else if (b.due_date) return 1;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

// ─── Progress helpers ─────────────────────────────────────────────────────────

function calculateProgress(subtasks: Subtask[]) {
  const total = subtasks.length;
  const completed = subtasks.filter((s) => s.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}

function ProgressBar({ subtasks }: { subtasks: Subtask[] }) {
  const { completed, total, percent } = calculateProgress(subtasks);
  if (total === 0) return null;
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>{completed}/{total} subtasks</span>
        <span>{percent}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-200 ${percent === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function SubtaskList({ todoId, subtasks, onChange }: {
  todoId: number;
  subtasks: Subtask[];
  onChange: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const addSubtask = async () => {
    const title = newTitle.trim();
    if (!title) return;
    await fetch(`/api/todos/${todoId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    setNewTitle('');
    onChange();
  };

  const toggleSubtask = async (subtask: Subtask) => {
    await fetch(`/api/subtasks/${subtask.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !subtask.completed }),
    });
    onChange();
  };

  const deleteSubtask = async (id: number) => {
    await fetch(`/api/subtasks/${id}`, { method: 'DELETE' });
    onChange();
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        {expanded ? '▼' : '▶'} Subtasks
      </button>

      <ProgressBar subtasks={subtasks} />

      {expanded && (
        <div className="mt-2 space-y-1 pl-3 border-l-2 border-gray-200 dark:border-gray-600">
          {subtasks.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(s.completed)}
                onChange={() => toggleSubtask(s)}
                className="h-3.5 w-3.5 rounded"
              />
              <span className={`flex-1 text-sm ${s.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                {s.title}
              </span>
              <button
                type="button"
                onClick={() => deleteSubtask(s.id)}
                className="text-gray-300 hover:text-red-500 dark:hover:text-red-400 text-xs leading-none"
                aria-label="Delete subtask"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
              placeholder="Add subtask…"
              className="flex-1 border rounded px-2 py-0.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <button
              type="button"
              onClick={addSubtask}
              disabled={!newTitle.trim()}
              className="text-sm text-blue-600 dark:text-blue-400 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TagPill component ────────────────────────────────────────────────────────

interface TagPillProps {
  tag: Tag;
  selected?: boolean;
  onClick?: (tag: Tag) => void;
  onFilterClick?: (tag: Tag) => void;
}

function TagPill({ tag, selected = false, onClick, onFilterClick }: TagPillProps) {
  const handleClick = () => {
    if (onClick) onClick(tag);
    else if (onFilterClick) onFilterClick(tag);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={selected || onFilterClick ? { backgroundColor: tag.color } : undefined}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium border transition-colors
        ${
          selected
            ? 'text-white border-transparent'
            : onFilterClick
              ? 'text-white border-transparent opacity-80 hover:opacity-100'
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-gray-400'
        }`}
    >
      {selected && <span aria-hidden>✓</span>}
      <span className="truncate max-w-[10rem]">{tag.name}</span>
    </button>
  );
}

// ─── Export / Import toolbar ──────────────────────────────────────────────────

function ExportImportToolbar({ onImported }: { onImported: () => void }) {
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const download = (format: 'json' | 'csv') => {
    window.location.href = `/api/todos/export?format=${format}`;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage(null);
    try {
      const text = await file.text();
      const body = JSON.parse(text);
      const res = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to import todos');
      setMessage({ type: 'success', text: `Successfully imported ${data.imported} todos` });
      onImported();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof SyntaxError ? 'Invalid JSON format' : (err as Error).message,
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <button
        onClick={() => download('json')}
        className="text-xs bg-green-600 hover:bg-green-700 text-white rounded px-2 py-1"
      >
        Export JSON
      </button>
      <button
        onClick={() => download('csv')}
        className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white rounded px-2 py-1"
      >
        Export CSV
      </button>
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded px-2 py-1"
      >
        {importing ? 'Importing…' : 'Import'}
      </button>
      <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />
      {message && (
        <span className={`text-xs ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}

// ─── Template UI components ───────────────────────────────────────────────────

function SaveTemplateModal({ title, priority, onClose, onSaved }: {
  title: string;
  priority: Priority;
  onClose: () => void;
  onSaved: (t: Template) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: description || undefined, category: category || undefined, title_template: title, priority }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? 'Failed to save template');
      return;
    }
    onSaved(await res.json());
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm shadow-xl space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Save as Template</h2>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name *" className="w-full border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category: Work, Personal, Finance…" className="w-full border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-sm text-gray-500 dark:text-gray-400">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded px-4 py-1.5 text-sm">Save Template</button>
        </div>
      </div>
    </div>
  );
}

function TemplateManagerModal({ templates, onClose, onUse, onDelete }: {
  templates: Template[];
  onClose: () => void;
  onUse: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg shadow-xl">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">📋 Templates</h2>
        {templates.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No templates yet. Create a todo and click &quot;Save as Template&quot;.</p>}
        <ul className="space-y-3 max-h-96 overflow-y-auto">
          {templates.map((t) => (
            <li key={t.id} className="border dark:border-gray-600 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-800 dark:text-white">{t.name}</span>
                {t.category && <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">{t.category}</span>}
              </div>
              {t.description && <p className="text-xs text-gray-500 dark:text-gray-400">{t.description}</p>}
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">{t.title_template}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                  t.priority === 'high' ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700' :
                  t.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700' :
                  'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'}`}>{t.priority}</span>
                {t.is_recurring === 1 && t.recurrence_pattern && <span className="text-xs text-purple-600 dark:text-purple-400">🔄 {t.recurrence_pattern}</span>}
                {t.reminder_minutes && <span className="text-xs text-orange-600 dark:text-orange-400">🔔</span>}
              </div>
              <div className="flex gap-3 mt-2">
                <button onClick={() => onUse(t.id)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Use</button>
                <button onClick={() => onDelete(t.id)} className="text-sm text-red-600 dark:text-red-400 hover:underline">Delete</button>
              </div>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="mt-4 text-sm text-gray-500 dark:text-gray-400">Close</button>
      </div>
    </div>
  );
}

// ─── ManageTagsModal component ────────────────────────────────────────────────

interface ManageTagsModalProps {
  tags: Tag[];
  onClose: () => void;
  onCreate: (input: CreateTagInput) => Promise<void>;
  onUpdate: (id: number, input: UpdateTagInput) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

function ManageTagsModal({ tags, onClose, onCreate, onUpdate, onDelete }: ManageTagsModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [hexInput, setHexInput] = useState('#3B82F6');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editHex, setEditHex] = useState('');
  const [error, setError] = useState('');

  const syncHex = (hex: string) => {
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) setColor(hex);
    setHexInput(hex);
  };

  const handleCreate = async () => {
    setError('');
    try {
      await onCreate({ name, color });
      setName('');
      setColor('#3B82F6');
      setHexInput('#3B82F6');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditHex(tag.color);
  };

  const handleUpdate = async (id: number) => {
    setError('');
    try {
      await onUpdate(id, { name: editName, color: editColor });
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tag');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this tag? It will be removed from all todos.')) return;
    setError('');
    try {
      await onDelete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Manage Tags</h2>

        {error && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
            {error}
          </p>
        )}

        {/* Existing tags list */}
        <ul className="space-y-2 mb-4 max-h-64 overflow-y-auto">
          {tags.length === 0 && (
            <li className="text-sm text-gray-500 dark:text-gray-400">No tags yet.</li>
          )}
          {tags.map((tag) =>
            editingId === tag.id ? (
              <li key={tag.id} className="flex items-center gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 border rounded px-2 py-1 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => {
                    setEditColor(e.target.value);
                    setEditHex(e.target.value);
                  }}
                  className="h-7 w-7 rounded cursor-pointer border-0"
                />
                <input
                  value={editHex}
                  onChange={(e) => {
                    setEditHex(e.target.value);
                    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) setEditColor(e.target.value);
                  }}
                  className="w-24 border rounded px-2 py-1 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <button
                  onClick={() => handleUpdate(tag.id)}
                  className="text-sm text-green-600 dark:text-green-400 font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-sm text-gray-500 dark:text-gray-400"
                >
                  Cancel
                </button>
              </li>
            ) : (
              <li key={tag.id} className="flex items-center justify-between gap-2">
                <TagPill tag={tag} selected />
                <div className="flex gap-3 text-sm">
                  <button
                    onClick={() => startEdit(tag)}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="text-red-600 dark:text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>

        {/* Create new tag */}
        <div className="border-t dark:border-gray-700 pt-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New tag</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Tag name"
              className="flex-1 border rounded px-2 py-1 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setHexInput(e.target.value);
              }}
              className="h-8 w-8 rounded cursor-pointer border-0"
              title="Pick a color"
            />
            <input
              value={hexInput}
              onChange={(e) => syncHex(e.target.value)}
              placeholder="#3B82F6"
              className="w-24 border rounded px-2 py-1 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded px-3 py-1 text-sm"
            >
              Create
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
  const [filterTagId, setFilterTagId] = useState<number | null>(null);
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [showManageTags, setShowManageTags] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    const [todosRes, tagsRes, templatesRes] = await Promise.all([
      fetch('/api/todos'),
      fetch('/api/tags'),
      fetch('/api/templates'),
    ]);
    if (todosRes.ok) setTodos(await todosRes.json());
    if (tagsRes.ok) setTags(await tagsRes.json());
    if (templatesRes.ok) setTemplates(await templatesRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Tag CRUD ───────────────────────────────────────────────────────────────

  const handleCreateTag = async (input: CreateTagInput) => {
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Failed to create tag');
    }
    const tag: Tag = await res.json();
    setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handleUpdateTag = async (id: number, input: UpdateTagInput) => {
    const res = await fetch(`/api/tags/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Failed to update tag');
    }
    const updated: Tag = await res.json();
    setTags((prev) =>
      prev.map((t) => (t.id === id ? updated : t)).sort((a, b) => a.name.localeCompare(b.name)),
    );
    // Refresh todos so tag name/color updates propagate
    const todosRes = await fetch('/api/todos');
    if (todosRes.ok) setTodos(await todosRes.json());
  };

  const handleDeleteTag = async (id: number) => {
    const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Failed to delete tag');
    }
    setTags((prev) => prev.filter((t) => t.id !== id));
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Reset filter if the deleted tag was active
    if (filterTagId === id) setFilterTagId(null);
    // Refresh todos so deleted tag pills disappear
    const todosRes = await fetch('/api/todos');
    if (todosRes.ok) setTodos(await todosRes.json());
  };

  // ── Template handlers ──────────────────────────────────────────────────────

  const handleUseTemplate = async (id: number) => {
    const res = await fetch(`/api/templates/${id}/use`, { method: 'POST' });
    if (res.ok) await fetchData();
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  // ── Todo creation ──────────────────────────────────────────────────────────

  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newTitle.trim()) return;

    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), priority: newPriority }),
    });

    if (!res.ok) {
      setError('Failed to create todo');
      return;
    }

    const todo: Todo = await res.json();

    // Attach selected tags
    await Promise.all(
      [...selectedTagIds].map((tagId) =>
        fetch(`/api/todos/${todo.id}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag_id: tagId }),
        }),
      ),
    );

    setNewTitle('');
    setNewPriority('medium');
    setSelectedTagIds(new Set());
    await fetchData();
  };

  const handleToggleComplete = async (todo: Todo) => {
    await fetch(`/api/todos/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: todo.completed ? 0 : 1 }),
    });
    await fetchData();
  };

  const handleDeleteTodo = async (id: number) => {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  // ── Tag pill toggle (for todo creation form) ───────────────────────────────

  const toggleTagSelection = (tag: Tag) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tag.id)) next.delete(tag.id);
      else next.add(tag.id);
      return next;
    });
  };

  // ── Filtering ──────────────────────────────────────────────────────────────

  // ── Filtering + sectioning ─────────────────────────────────────────────────
  const now = new Date();

  const visibleTodos = todos.filter((todo) => {
    if (filterTagId && !todo.tags?.some((t) => t.id === filterTagId)) return false;
    if (filterPriority !== 'all' && todo.priority !== filterPriority) return false;
    return true;
  });

  const overdue  = visibleTodos.filter((t) => !t.completed && t.due_date && new Date(t.due_date) < now).sort(compareTodos);
  const pending  = visibleTodos.filter((t) => !t.completed && !(t.due_date && new Date(t.due_date) < now)).sort(compareTodos);
  const completed = visibleTodos.filter((t) => t.completed).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Todos</h1>
        <div className="flex flex-wrap gap-3 items-center">
          <Link href="/calendar" className="text-sm text-purple-600 dark:text-purple-400 hover:underline">📅 Calendar</Link>
          <ExportImportToolbar onImported={fetchData} />
          <button onClick={() => setShowTemplateManager(true)} className="text-sm text-purple-600 dark:text-purple-400 hover:underline">
            📋 Templates
          </button>
          <button onClick={() => setShowManageTags(true)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            + Manage Tags
          </button>
        </div>
      </div>

      {/* ── New todo form ────────────────────────────────────────────────── */}
      <form onSubmit={handleCreateTodo} className="mb-6 space-y-3">
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New todo…"
            className="flex-1 border rounded-lg px-3 py-2 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as Priority)}
            className="border rounded-lg px-2 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2"
          >
            Add
          </button>
        </div>

        {/* Tag pill selector */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <TagPill key={tag.id} tag={tag} selected={selectedTagIds.has(tag.id)} onClick={toggleTagSelection} />
            ))}
          </div>
        )}

        {/* Use Template / Save as Template row */}
        <div className="flex items-center gap-3 flex-wrap">
          {templates.length > 0 && (
            <select
              onChange={(e) => { if (e.target.value) { handleUseTemplate(Number(e.target.value)); e.target.value = ''; } }}
              defaultValue=""
              className="text-sm border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="" disabled>Use Template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.category ? ` (${t.category})` : ''}
                </option>
              ))}
            </select>
          )}
          {newTitle.trim() && (
            <button type="button" onClick={() => setShowSaveTemplate(true)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              💾 Save as Template
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <span className="text-sm text-gray-500 dark:text-gray-400">Filter:</span>

        {/* Priority filter */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as Priority | 'all')}
          className="text-sm border rounded-full px-3 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          <option value="all">All Priorities</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </select>

        {/* Tag filters */}
        {tags.length > 0 && (
          <>
            <button
              onClick={() => setFilterTagId(null)}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                filterTagId === null
                  ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-900 border-transparent'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
              }`}
            >
              All Tags
            </button>
            {tags.map((tag) => (
              <TagPill
                key={tag.id}
                tag={tag}
                onFilterClick={() => setFilterTagId(filterTagId === tag.id ? null : tag.id)}
                selected={filterTagId === tag.id}
              />
            ))}
          </>
        )}
      </div>

      {/* ── Todo sections ────────────────────────────────────────────────── */}
      {overdue.length === 0 && pending.length === 0 && completed.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          No todos yet. Create one above!
        </p>
      )}

      {[
        { label: 'Overdue', items: overdue, labelClass: 'text-red-600 dark:text-red-400' },
        { label: 'Pending', items: pending, labelClass: 'text-gray-700 dark:text-gray-200' },
        { label: 'Completed', items: completed, labelClass: 'text-gray-400 dark:text-gray-500' },
      ].map(({ label, items, labelClass }) =>
        items.length === 0 ? null : (
          <section key={label} className="mb-6">
            <h2 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${labelClass}`}>
              {label} ({items.length})
            </h2>
            <ul className="space-y-2">
              {items.map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-start gap-3 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-100 dark:border-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={todo.completed === 1}
                    onChange={() => handleToggleComplete(todo)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-gray-800 dark:text-white ${todo.completed ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                        {todo.title}
                      </p>
                      <PriorityBadge priority={todo.priority} />
                    </div>
                    {/* Tag pills */}
                    {todo.tags && todo.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {todo.tags.map((tag) => (
                          <TagPill
                            key={tag.id}
                            tag={tag}
                            onFilterClick={() => setFilterTagId(filterTagId === tag.id ? null : tag.id)}
                          />
                        ))}
                      </div>
                    )}
                    {/* Subtasks */}
                    <SubtaskList
                      todoId={todo.id}
                      subtasks={todo.subtasks ?? []}
                      onChange={fetchData}
                    />
                  </div>
                  <button
                    onClick={() => handleDeleteTodo(todo.id)}
                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-lg leading-none"
                    aria-label="Delete todo"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      )}

      {/* ── Manage Tags modal ────────────────────────────────────────────── */}
      {showManageTags && (
        <ManageTagsModal
          tags={tags}
          onClose={() => setShowManageTags(false)}
          onCreate={handleCreateTag}
          onUpdate={handleUpdateTag}
          onDelete={handleDeleteTag}
        />
      )}

      {/* ── Save Template modal ───────────────────────────────────────────── */}
      {showSaveTemplate && (
        <SaveTemplateModal
          title={newTitle}
          priority={newPriority}
          onClose={() => setShowSaveTemplate(false)}
          onSaved={(t) => {
            setTemplates((prev) => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)));
            setShowSaveTemplate(false);
          }}
        />
      )}

      {/* ── Template Manager modal ────────────────────────────────────────── */}
      {showTemplateManager && (
        <TemplateManagerModal
          templates={templates}
          onClose={() => setShowTemplateManager(false)}
          onUse={async (id) => { await handleUseTemplate(id); setShowTemplateManager(false); }}
          onDelete={handleDeleteTemplate}
        />
      )}
    </main>
  );
}
