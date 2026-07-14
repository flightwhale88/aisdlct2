import { describe, expect, it } from 'vitest';

import { calculateNextDueDate } from '../lib/recurrence';

describe('calculateNextDueDate', () => {
  it('adds one day for daily recurrence', () => {
    expect(calculateNextDueDate('2025-11-10T14:00', 'daily')).toBe('2025-11-11T14:00');
  });

  it('adds seven days for weekly recurrence', () => {
    expect(calculateNextDueDate('2025-11-10T14:00', 'weekly')).toBe('2025-11-17T14:00');
  });

  it('keeps the same day in the next month when possible', () => {
    expect(calculateNextDueDate('2025-06-15T09:00', 'monthly')).toBe('2025-07-15T09:00');
  });

  it('clamps month-end overflow to the last day of the target month', () => {
    expect(calculateNextDueDate('2025-01-31T09:00', 'monthly')).toBe('2025-02-28T09:00');
  });

  it('clamps leap-year month-end overflow correctly', () => {
    expect(calculateNextDueDate('2024-01-31T09:00', 'monthly')).toBe('2024-02-29T09:00');
  });

  it('rolls from December to January with year increment', () => {
    expect(calculateNextDueDate('2025-12-31T09:00', 'monthly')).toBe('2026-01-31T09:00');
  });

  it('adds one year for yearly recurrence', () => {
    expect(calculateNextDueDate('2025-06-15T09:00', 'yearly')).toBe('2026-06-15T09:00');
  });

  it('clamps leap day yearly recurrence to february 28', () => {
    expect(calculateNextDueDate('2024-02-29T09:00', 'yearly')).toBe('2025-02-28T09:00');
  });

  it('preserves the time of day', () => {
    expect(calculateNextDueDate('2025-03-10T21:45', 'weekly')).toBe('2025-03-17T21:45');
  });

  it('preserves seconds when the source due date includes them', () => {
    expect(calculateNextDueDate('2025-03-10T21:45:30', 'weekly')).toBe('2025-03-17T21:45:30');
  });
});