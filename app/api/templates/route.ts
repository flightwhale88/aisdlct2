import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { templateDB, validatePriority } from '@/lib/db';
import type { Priority, RecurrencePattern, TemplateSubtask } from '@/lib/db';

// GET /api/templates
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json(templateDB.findAllByUser(session.userId));
}

// POST /api/templates
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  const { name, description, category, title_template, priority, is_recurring,
    recurrence_pattern, reminder_minutes, due_date_offset_minutes, subtasks } = body as {
    name?: string;
    description?: string;
    category?: string;
    title_template?: string;
    priority?: string;
    is_recurring?: boolean;
    recurrence_pattern?: string;
    reminder_minutes?: number;
    due_date_offset_minutes?: number;
    subtasks?: TemplateSubtask[];
  };

  if (!name?.trim() || !title_template?.trim()) {
    return NextResponse.json({ error: 'Name and title are required' }, { status: 400 });
  }

  let validatedPriority: Priority;
  try {
    validatedPriority = validatePriority(priority);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  // Reject recurring templates without a due-date offset (PRP-07 edge case)
  if (is_recurring && !due_date_offset_minutes) {
    return NextResponse.json(
      { error: 'Recurring templates require a due_date_offset_minutes' },
      { status: 400 },
    );
  }

  const subtasks_json = subtasks?.length
    ? JSON.stringify(subtasks.map((s, i) => ({ title: s.title, position: i })))
    : null;

  const template = templateDB.create({
    user_id: session.userId,
    name: name.trim(),
    description: description ?? null,
    category: category ?? null,
    title_template: title_template.trim(),
    priority: validatedPriority,
    is_recurring: is_recurring ?? false,
    recurrence_pattern: (recurrence_pattern as RecurrencePattern) ?? null,
    reminder_minutes: reminder_minutes ?? null,
    due_date_offset_minutes: due_date_offset_minutes ?? null,
    subtasks_json,
  });

  return NextResponse.json(template, { status: 201 });
}
