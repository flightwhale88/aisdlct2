import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { templateDB, todoDB, subtaskDB } from '@/lib/db';
import { getSingaporeNow } from '@/lib/timezone';
import type { TemplateSubtask } from '@/lib/db';

// POST /api/templates/[id]/use — instantiate a todo from a template
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const template = templateDB.findById(parseInt(id, 10));

  if (!template || template.user_id !== session.userId) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  // Resolve due date from offset (Singapore time)
  let due_date: string | null = null;
  if (template.due_date_offset_minutes != null) {
    const d = getSingaporeNow();
    d.setMinutes(d.getMinutes() + template.due_date_offset_minutes);
    due_date = d.toISOString();
  }

  const todo = todoDB.create(session.userId, {
    title: template.title_template,
    priority: template.priority,
    due_date,
    recurrence: template.is_recurring ? template.recurrence_pattern : null,
    reminder_minutes: template.reminder_minutes,
  });

  // Deserialize and recreate subtasks — malformed JSON must not block todo creation
  let subtasks: TemplateSubtask[] = [];
  if (template.subtasks_json) {
    try {
      subtasks = JSON.parse(template.subtasks_json);
    } catch {
      subtasks = [];
    }
  }

  for (const s of subtasks) {
    subtaskDB.create(todo.id, s.title, s.position);
  }

  const created = todoDB.findById(todo.id, session.userId);
  return NextResponse.json(created, { status: 201 });
}
