import { fromSingaporeParts, parseSingaporeDateTime, toSingaporeParts } from '@/lib/timezone';

import type { RecurrencePattern } from './db';

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export function calculateNextDueDate(currentDueDate: string, pattern: RecurrencePattern): string {
  const parsed = parseSingaporeDateTime(currentDueDate);
  if (!parsed) {
    throw new Error('Invalid due date');
  }

  const includesSeconds = /:\d{2}:\d{2}(?:[+-]\d{2}:?\d{2}|Z)?$/i.test(currentDueDate);

  const { year, month, day, hour, minute } = toSingaporeParts(parsed);

  switch (pattern) {
    case 'daily':
      return normalizePrecision(fromSingaporeParts(toSingaporeParts(addDays(parsed, 1)), hour, minute, toSingaporeParts(parsed).second), includesSeconds);
    case 'weekly':
      return normalizePrecision(fromSingaporeParts(toSingaporeParts(addDays(parsed, 7)), hour, minute, toSingaporeParts(parsed).second), includesSeconds);
    case 'monthly': {
      const targetMonth = month === 12 ? 1 : month + 1;
      const targetYear = month === 12 ? year + 1 : year;
      const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
      return normalizePrecision(fromSingaporeParts({ year: targetYear, month: targetMonth, day: clampedDay }, hour, minute, toSingaporeParts(parsed).second), includesSeconds);
    }
    case 'yearly': {
      const targetYear = year + 1;
      const clampedDay = Math.min(day, daysInMonth(targetYear, month));
      return normalizePrecision(fromSingaporeParts({ year: targetYear, month, day: clampedDay }, hour, minute, toSingaporeParts(parsed).second), includesSeconds);
    }
  }
}

function normalizePrecision(value: string, includesSeconds: boolean): string {
  return includesSeconds ? value.slice(0, 19) : value.slice(0, 16);
}