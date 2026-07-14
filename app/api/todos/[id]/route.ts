import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { todoDB, type Priority, type RecurrencePattern } from '@/lib/db';
import { getSingaporeNow, isAtLeastOneMinuteAhead, parseSingaporeDateTime } from '@/lib/timezone';

function isPriority(value: unknown): value is Priority {
  return value === 'high' || value === 'medium' || value === 'low';
}

function isRecurrencePattern(value: unknown): value is RecurrencePattern {
  return value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly';
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
    recurrence_pattern: isRecurrencePattern(body.recurrence_pattern) ? body.recurrence_pattern : undefined,
    reminder_minutes: typeof body.reminder_minutes === 'number' ? body.reminder_minutes : undefined,
  });

  return NextResponse.json(updated);
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