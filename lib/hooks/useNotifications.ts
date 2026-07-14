'use client';

import { useCallback, useEffect, useState } from 'react';

import { REMINDER_LABELS, type ReminderMinutes } from '@/lib/reminders';
import { formatSingaporeDateTime, parseSingaporeDateTime } from '@/lib/timezone';

type NotificationTodo = {
  id: number;
  title: string;
  due_date: string | null;
  reminder_minutes: ReminderMinutes | null;
};

function canUseBrowserNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function formatReminderBody(dueDate: string | null): string {
  if (!dueDate) {
    return 'Reminder time reached';
  }

  const parsed = parseSingaporeDateTime(dueDate);
  return parsed ? `Due ${formatSingaporeDateTime(parsed)}` : `Due ${dueDate}`;
}

export function useNotifications(): {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  supported: boolean;
} {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (canUseBrowserNotifications()) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!canUseBrowserNotifications()) {
      return 'denied';
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  useEffect(() => {
    if (!canUseBrowserNotifications() || permission !== 'granted') {
      return;
    }

    let cancelled = false;

    const poll = async (): Promise<void> => {
      if (cancelled || !canUseBrowserNotifications() || Notification.permission !== 'granted') {
        return;
      }

      const response = await fetch('/api/notifications/check', { cache: 'no-store' });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { data?: NotificationTodo[] };
      for (const todo of payload.data ?? []) {
        if (cancelled || Notification.permission !== 'granted') {
          break;
        }

        const reminderMinutes = todo.reminder_minutes;
        if (reminderMinutes === null) {
          continue;
        }

        new Notification(todo.title, {
          body: formatReminderBody(todo.due_date),
          tag: `todo-${todo.id}`,
        });
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [permission]);

  return {
    permission,
    requestPermission,
    supported: canUseBrowserNotifications(),
  };
}

export function getReminderLabel(minutes: ReminderMinutes): string {
  return REMINDER_LABELS[minutes];
}