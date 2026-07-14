import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { PRIORITY_VALUES, Priority, todoDB } from '@/lib/db';
import { getSingaporeNow } from '@/lib/timezone';

function isValidPriority(priority: unknown): priority is Priority {
  return PRIORITY_VALUES.includes(priority as Priority);
}

function validatePriorityForUpdate(value: unknown): Priority | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (isValidPriority(value)) {
    return value;
  }

  throw new Error(
    `Invalid priority: ${String(value)}. Must be 'high', 'medium', or 'low'.`
  );
}

function parseDueDate(dueDate: unknown): string | null | undefined {
  if (dueDate === undefined) {
    return undefined;
  }

  if (dueDate === null || dueDate === '') {
    return null;
  }

  if (typeof dueDate !== 'string') {
    throw new Error('Due date is invalid');
  }

  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Due date is invalid');
  }

  const minDue = new Date(getSingaporeNow().getTime() + 60_000);
  if (parsed < minDue) {
    throw new Error('Due date must be at least 1 minute in the future');
  }

  return parsed.toISOString();
}

async function getOwnedTodoId(params: Promise<{ id: string }>, userId: number): Promise<number | null> {
  const { id } = await params;
  const todoId = Number(id);
  if (!Number.isInteger(todoId) || todoId <= 0) {
    return null;
  }

  const existing = todoDB.findById(todoId);
  if (!existing || existing.user_id !== userId) {
    return null;
  }

  return todoId;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const todoId = await getOwnedTodoId(params, session.userId);
  if (!todoId) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json(todoDB.findById(todoId));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const todoId = await getOwnedTodoId(params, session.userId);
  if (!todoId) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  const body = (await request.json()) as {
    title?: string;
    completed?: boolean;
    due_date?: string | null;
    priority?: Priority;
  };

  if (body.title !== undefined && !body.title.trim()) {
    return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
  }

  if (body.completed !== undefined && typeof body.completed !== 'boolean') {
    return NextResponse.json({ error: 'Completed is invalid' }, { status: 400 });
  }

  try {
    const updated = todoDB.update(todoId, {
      title: body.title?.trim(),
      completed: body.completed,
      due_date: parseDueDate(body.due_date),
      priority: validatePriorityForUpdate(body.priority),
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const todoId = await getOwnedTodoId(params, session.userId);
  if (!todoId) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  todoDB.delete(todoId);
  return NextResponse.json({ success: true });
}
