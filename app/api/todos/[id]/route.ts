import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { todoDB, type Priority, type RecurrencePattern } from '@/lib/db';
import { isReminderMinutes } from '@/lib/reminders';
import { calculateNextDueDate } from '@/lib/recurrence';
import { getSingaporeNow, isAtLeastOneMinuteAhead, parseSingaporeDateTime } from '@/lib/timezone';

function isPriority(value: unknown): value is Priority {
  return value === 'high' || value === 'medium' || value === 'low';
}

function isRecurrencePattern(value: unknown): value is RecurrencePattern {
  return value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly';
}

function isTagArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isIsoStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  return request.json() as Promise<Record<string, unknown>>;
}

function parseTodoId(rawId: string): number | null {
  const parsed = Number.parseInt(rawId, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function getOwnedTodo(todoId: number, userId: number) {
  const todo = todoDB.findById(todoId);
  if (!todo || todo.user_id !== userId) {
    return null;
  }

  return todo;
}

function resolveRecurringState(existing: Awaited<ReturnType<typeof getOwnedTodo>>, body: Record<string, unknown>) {
  const isRecurring = typeof body.is_recurring === 'boolean' ? body.is_recurring : existing?.is_recurring ?? false;
  const recurrencePattern = isRecurrencePattern(body.recurrence_pattern)
    ? body.recurrence_pattern
    : typeof body.is_recurring === 'boolean' && body.is_recurring === false
      ? null
      : existing?.recurrence_pattern ?? null;

  return { isRecurring, recurrencePattern };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = parseTodoId(id);
  if (todoId === null) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  const todo = await getOwnedTodo(todoId, session.userId);
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json(todo);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = parseTodoId(id);
  if (todoId === null) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  const todo = await getOwnedTodo(todoId, session.userId);
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await readBody(request);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.title === 'string' && !body.title.trim()) {
    return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
  }

  if (typeof body.due_date === 'string') {
    const trimmedDueDate = body.due_date.trim();
    if (!trimmedDueDate || !parseSingaporeDateTime(trimmedDueDate)) {
      return NextResponse.json({ error: 'Due date is invalid' }, { status: 400 });
    }

    if (!isAtLeastOneMinuteAhead(trimmedDueDate, getSingaporeNow())) {
      return NextResponse.json({ error: 'Due date must be at least 1 minute in the future' }, { status: 400 });
    }
  }

  if (body.recurrence_pattern !== undefined && body.recurrence_pattern !== null && !isRecurrencePattern(body.recurrence_pattern)) {
    return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 });
  }

  if (body.tags !== undefined && !isTagArray(body.tags)) {
    return NextResponse.json({ error: 'tags must be an array of strings' }, { status: 400 });
  }

  if (body.reminder_minutes !== undefined && body.reminder_minutes !== null && !isReminderMinutes(body.reminder_minutes)) {
    return NextResponse.json({ error: 'Invalid reminder minutes' }, { status: 400 });
  }

  if (body.last_notification_sent !== undefined && !isIsoStringOrNull(body.last_notification_sent)) {
    return NextResponse.json({ error: 'last_notification_sent must be a string or null' }, { status: 400 });
  }

  const effectiveDueDate =
    typeof body.due_date === 'string'
      ? body.due_date.trim()
      : body.due_date === null
        ? null
        : todo.due_date;
  const { isRecurring, recurrencePattern } = resolveRecurringState(todo, body);

  if (isRecurring && !effectiveDueDate) {
    return NextResponse.json({ error: 'Recurring todos require a due date' }, { status: 400 });
  }

  if (isRecurring && recurrencePattern === null) {
    return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 });
  }

  const updated = todoDB.update(todoId, {
    title: typeof body.title === 'string' ? body.title.trim() : undefined,
    completed: typeof body.completed === 'boolean' ? body.completed : undefined,
    due_date:
      typeof body.due_date === 'string'
        ? body.due_date.trim()
        : body.due_date === null
          ? null
          : undefined,
    priority: isPriority(body.priority) ? body.priority : undefined,
    is_recurring: typeof body.is_recurring === 'boolean' ? body.is_recurring : undefined,
    recurrence_pattern:
      typeof body.is_recurring === 'boolean' && body.is_recurring === false
        ? null
        : isRecurrencePattern(body.recurrence_pattern)
          ? body.recurrence_pattern
          : undefined,
    reminder_minutes: isReminderMinutes(body.reminder_minutes) ? body.reminder_minutes : undefined,
    last_notification_sent:
      body.due_date !== undefined || body.reminder_minutes !== undefined
        ? null
        : isIsoStringOrNull(body.last_notification_sent)
          ? body.last_notification_sent
          : undefined,
    tags: isTagArray(body.tags) ? body.tags : undefined,
  });

  const justCompleted = body.completed === true && todo.completed === false;
  let nextInstance = null;

  if (justCompleted && updated.is_recurring && updated.recurrence_pattern && updated.due_date) {
    const nextDueDate = calculateNextDueDate(updated.due_date, updated.recurrence_pattern);
    nextInstance = todoDB.create({
      user_id: session.userId,
      title: updated.title,
      due_date: nextDueDate,
      priority: updated.priority,
      is_recurring: true,
      recurrence_pattern: updated.recurrence_pattern,
      reminder_minutes: updated.reminder_minutes,
      tags: updated.tags,
      last_notification_sent: null,
    });
  }

  return NextResponse.json(nextInstance ? { todo: updated, nextInstance } : { todo: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = parseTodoId(id);
  if (todoId === null) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  const todo = await getOwnedTodo(todoId, session.userId);
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  todoDB.delete(todoId);
  return NextResponse.json({ success: true });
}