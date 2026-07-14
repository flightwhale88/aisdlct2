import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB, validatePriority } from '@/lib/db';

// GET /api/todos — list all todos for the authenticated user
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const todos = todoDB.findAllByUser(session.userId);
  return NextResponse.json(todos);
}

// POST /api/todos — create a new todo
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { title, priority, due_date, recurrence, reminder_minutes } = body as {
    title?: string;
    priority?: string;
    due_date?: string;
    recurrence?: string;
    reminder_minutes?: number;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  let validatedPriority;
  try {
    validatedPriority = validatePriority(priority);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const todo = todoDB.create(session.userId, {
    title: title.trim(),
    priority: validatedPriority,
    due_date: due_date ?? null,
    recurrence: (['daily', 'weekly', 'monthly', 'yearly'].includes(recurrence ?? '')
      ? recurrence
      : null) as 'daily' | 'weekly' | 'monthly' | 'yearly' | null,
    reminder_minutes: reminder_minutes ?? null,
  });

  return NextResponse.json(todo, { status: 201 });
}
