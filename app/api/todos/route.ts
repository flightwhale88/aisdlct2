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

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json(todoDB.findAllByUser(session.userId));
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await readBody(request);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const dueDate = typeof body.due_date === 'string' && body.due_date.trim().length > 0
    ? body.due_date.trim()
    : null;

  if (dueDate !== null && !parseSingaporeDateTime(dueDate)) {
    return NextResponse.json({ error: 'Due date is invalid' }, { status: 400 });
  }

  if (dueDate !== null && !isAtLeastOneMinuteAhead(dueDate, getSingaporeNow())) {
    return NextResponse.json({ error: 'Due date must be at least 1 minute in the future' }, { status: 400 });
  }

  const todo = todoDB.create({
    user_id: session.userId,
    title,
    due_date: dueDate,
    priority: isPriority(body.priority) ? body.priority : 'medium',
    is_recurring: typeof body.is_recurring === 'boolean' ? body.is_recurring : false,
    recurrence_pattern: isRecurrencePattern(body.recurrence_pattern) ? body.recurrence_pattern : null,
    reminder_minutes: typeof body.reminder_minutes === 'number' ? body.reminder_minutes : null,
  });

  return NextResponse.json(todo, { status: 201 });
}