import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { db, todoDB, type Todo } from '@/lib/db';
import { getSingaporeNow, parseSingaporeDateTime } from '@/lib/timezone';

function isReminderDue(todo: Todo, now: Date): boolean {
  if (todo.completed || todo.due_date === null || todo.reminder_minutes === null || todo.last_notification_sent !== null) {
    return false;
  }

  const dueDate = parseSingaporeDateTime(todo.due_date);
  if (!dueDate) {
    return false;
  }

  const reminderWindowStart = new Date(dueDate.getTime() - todo.reminder_minutes * 60_000);
  return reminderWindowStart.getTime() <= now.getTime() && now.getTime() <= dueDate.getTime();
}

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const now = getSingaporeNow();
  const claimDueReminders = db.transaction((userId: number, claimAt: string): Todo[] => {
    const dueReminders = todoDB.findAllByUser(userId).filter((todo) => isReminderDue(todo, now));

    return dueReminders.map((todo) =>
      todoDB.update(todo.id, {
        last_notification_sent: claimAt,
      }),
    );
  });

  const dueReminders = claimDueReminders(session.userId, now.toISOString());

  return NextResponse.json({ success: true, data: dueReminders });
}