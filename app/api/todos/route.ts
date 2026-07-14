import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { PRIORITY_VALUES, Priority, todoDB } from '@/lib/db';
import { getSingaporeNow } from '@/lib/timezone';

function isValidPriority(priority: unknown): priority is Priority {
  return PRIORITY_VALUES.includes(priority as Priority);
}

function validatePriority(value: unknown): Priority {
  if (value === undefined || value === null) {
    return 'medium';
  }

  if (isValidPriority(value)) {
    return value;
  }

  throw new Error(
    `Invalid priority: ${String(value)}. Must be 'high', 'medium', or 'low'.`
  );
}

function validateDueDate(dueDate: unknown): string | null {
  if (dueDate === undefined || dueDate === null || dueDate === '') {
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    due_date?: string | null;
    priority?: Priority;
  };

  const title = (body.title ?? '').trim();
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  try {
    const todo = todoDB.create({
      user_id: session.userId,
      title,
      due_date: validateDueDate(body.due_date),
      priority: validatePriority(body.priority),
      is_recurring: false,
      recurrence_pattern: null,
      reminder_minutes: null,
      tag_ids: [],
    });

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const priorityParam = request.nextUrl.searchParams.get('priority');
  let todos = todoDB.findAllByUser(session.userId);

  if (priorityParam !== null) {
    if (!isValidPriority(priorityParam)) {
      return NextResponse.json(
        {
          error: `Invalid priority: ${priorityParam}. Must be 'high', 'medium', or 'low'.`,
        },
        { status: 400 }
      );
    }
    todos = todos.filter((todo) => todo.priority === priorityParam);
  }

  return NextResponse.json(todos);
}
