import { getSingaporeNow, formatSingaporeDate } from '@/lib/timezone';

export interface CalendarDay {
  date: string;          // YYYY-MM-DD Singapore-local
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
}

/**
 * Generates exactly 42 calendar cells (6 rows × 7 cols, Sun–Sat).
 * @param year  Full year (e.g. 2026)
 * @param month 1-indexed month (1 = January)
 */
export function generateCalendarGrid(year: number, month: number): CalendarDay[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = firstOfMonth.getUTCDay(); // 0 = Sunday
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const today = formatSingaporeDate(getSingaporeNow());
  const cells: CalendarDay[] = [];

  for (let i = 0; i < 42; i++) {
    const dayOffset = i - startWeekday + 1;
    const cellDate = new Date(Date.UTC(year, month - 1, dayOffset));
    const dateStr = formatSingaporeDate(cellDate);
    const weekday = cellDate.getUTCDay();

    cells.push({
      date: dateStr,
      isCurrentMonth: dayOffset >= 1 && dayOffset <= daysInMonth,
      isToday: dateStr === today,
      isPast: dateStr < today,
      isWeekend: weekday === 0 || weekday === 6,
    });
  }

  return cells;
}

/** Parse ?month=YYYY-MM, falling back to current Singapore month. */
export function parseMonthParam(raw: string | null): { year: number; month: number } {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m };
  }
  const now = getSingaporeNow();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Format year/month as YYYY-MM for URL. */
export function toMonthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Add/subtract months, handling year wrap. */
export function addMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}
