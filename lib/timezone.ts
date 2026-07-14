export const SINGAPORE_TIME_ZONE = 'Asia/Singapore';

export function getSingaporeNow(): Date {
  return new Date();
}

export function formatSingaporeDateTime(date: Date = getSingaporeNow()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SINGAPORE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((item) => item.type === type);
    return part?.value ?? '';
  };

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
}

export function parseSingaporeDateTime(value: string): Date | null {
  const normalized = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value
    : value.includes('T')
      ? `${value}+08:00`
      : `${value}T00:00:00+08:00`;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isAtLeastOneMinuteAhead(value: string, reference: Date = getSingaporeNow()): boolean {
  const parsed = parseSingaporeDateTime(value);
  return parsed !== null && parsed.getTime() >= reference.getTime() + 60_000;
}

export function toSingaporeDateInputValue(date: Date = getSingaporeNow()): string {
  return formatSingaporeDateTime(date).slice(0, 16);
}