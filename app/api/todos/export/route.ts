import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';
import { getSingaporeNow, formatSingaporeDate } from '@/lib/timezone';

// RFC 4180 CSV cell escape
function csvCell(val: string | number | boolean | null | undefined): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(todos: ReturnType<typeof todoDB.findAllByUser>): string {
  const header = 'ID,Title,Completed,Due Date,Priority,Recurring,Pattern,Reminder';
  const rows = todos.map((t) =>
    [
      t.id,
      csvCell(t.title),
      t.completed ? 'true' : 'false',
      csvCell(t.due_date),
      csvCell(t.priority),
      t.recurrence ? 'true' : 'false',
      csvCell(t.recurrence),
      csvCell(t.reminder_minutes),
    ].join(','),
  );
  return [header, ...rows].join('\r\n');
}

// GET /api/todos/export?format=json|csv
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const format = request.nextUrl.searchParams.get('format') ?? 'json';
  const todos = todoDB.findAllByUser(session.userId);
  const dateStr = formatSingaporeDate(getSingaporeNow());

  if (format === 'csv') {
    return new NextResponse(toCsv(todos), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="todos-${dateStr}.csv"`,
      },
    });
  }

  const payload = {
    version: 1,
    exported_at: getSingaporeNow().toISOString(),
    todos: todos.map((t) => ({
      title: t.title,
      completed: Boolean(t.completed),
      due_date: t.due_date ?? null,
      priority: t.priority,
      is_recurring: Boolean(t.recurrence),
      recurrence_pattern: t.recurrence ?? null,
      reminder_minutes: t.reminder_minutes ?? null,
      created_at: t.created_at,
      subtasks: (t.subtasks ?? []).map((s) => ({
        title: s.title,
        completed: Boolean(s.completed),
        position: s.position,
      })),
      tags: (t.tags ?? []).map((g) => ({ name: g.name, color: g.color })),
    })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="todos-${dateStr}.json"`,
    },
  });
}
