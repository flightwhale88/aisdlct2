const SINGAPORE_TZ = 'Asia/Singapore';

/**
 * Returns the current date/time in Singapore timezone.
 * Always use this instead of `new Date()` for any date/time logic.
 */
export function getSingaporeNow(): Date {
  // JavaScript Date is always UTC internally; we return a Date whose
  // .toLocaleString() in Asia/Singapore matches "now" in Singapore.
  return new Date(new Date().toLocaleString('en-US', { timeZone: SINGAPORE_TZ }));
}

/**
 * Formats a Date (or ISO string) as YYYY-MM-DD in Singapore timezone.
 */
export function formatSingaporeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('sv-SE', { timeZone: SINGAPORE_TZ }); // sv-SE gives YYYY-MM-DD
}

/**
 * Returns a Singapore-local ISO datetime string (no timezone suffix).
 */
export function getSingaporeDateTimeString(date?: Date): string {
  const d = date ?? new Date();
  return d
    .toLocaleString('sv-SE', { timeZone: SINGAPORE_TZ })
    .replace(' ', 'T');
}

/**
 * Parses a date string assuming Singapore timezone, returns a UTC Date.
 */
export function parseSingaporeDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+08:00`);
}
