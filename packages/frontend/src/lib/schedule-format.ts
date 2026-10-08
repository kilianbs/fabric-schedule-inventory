//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ScheduleRecord } from '@rayfin-app/shared';

/**
 * Display helpers for schedule rows. Every value is treated as untrusted
 * display input: optional fields may be missing and JSON columns are parsed
 * defensively, falling back to an em dash.
 */

const WEEKDAY_SHORT: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

/** Parse a JSON string-array column; bad or missing values return null. */
export function parseJsonList(value: string | undefined): string[] | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    const strings = parsed.filter(
      (entry): entry is string => typeof entry === 'string'
    );
    return strings.length === parsed.length ? strings : null;
  } catch {
    return null;
  }
}

export function describeMonthly(value: string | undefined): string {
  if (typeof value !== 'string' || value.length === 0) return '—';
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return '—';
    const record = parsed as { occurrence?: unknown; recurrence?: unknown };
    const parts: string[] = [];
    if (typeof record.recurrence === 'number')
      parts.push(
        record.recurrence === 1
          ? 'every month'
          : `every ${record.recurrence} months`
      );
    const occurrence = record.occurrence;
    if (typeof occurrence === 'object' && occurrence !== null) {
      const info = occurrence as Record<string, unknown>;
      const bits = Object.entries(info)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${String(v)}`);
      if (bits.length > 0) parts.push(bits.join(', '));
    }
    return parts.length > 0 ? parts.join('; ') : '—';
  } catch {
    return '—';
  }
}

/** "monday" → "Mon"; unknown names pass through unchanged. */
export function shortWeekday(value: string): string {
  return WEEKDAY_SHORT[value.toLowerCase()] ?? value;
}

export function joinList(values: readonly string[] | null): string {
  return values === null || values.length === 0 ? '—' : values.join(', ');
}

/** Human interval: 30 → "30 min", 120 → "2 h", 90 → "90 min", 1440 → "1 day". */
export function formatInterval(minutes: number): string {
  if (minutes > 0 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  if (minutes > 0 && minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}

/**
 * One readable line for a schedule's cadence, e.g. "Every 30 min",
 * "Daily at 08:00, 14:00", "Weekly on Mon, Wed at 09:00".
 */
export function describeSchedule(
  schedule: Pick<
    ScheduleRecord,
    | 'configType'
    | 'intervalMinutes'
    | 'timesJson'
    | 'weekdaysJson'
    | 'monthlyConfigJson'
  >
): string {
  const type =
    typeof schedule.configType === 'string'
      ? schedule.configType.toLowerCase()
      : '';
  const times = parseJsonList(schedule.timesJson);
  const at = times && times.length > 0 ? ` at ${times.join(', ')}` : '';

  if (type === 'cron' || (type === '' && typeof schedule.intervalMinutes === 'number')) {
    return typeof schedule.intervalMinutes === 'number'
      ? `Every ${formatInterval(schedule.intervalMinutes)}`
      : 'Interval';
  }
  if (type === 'daily') return `Daily${at}`;
  if (type === 'weekly') {
    const days = parseJsonList(schedule.weekdaysJson);
    const on =
      days && days.length > 0 ? ` on ${days.map(shortWeekday).join(', ')}` : '';
    return `Weekly${on}${at}`;
  }
  if (type === 'monthly') {
    const monthly = describeMonthly(schedule.monthlyConfigJson);
    return `Monthly${monthly === '—' ? '' : ` (${monthly})`}${at}`;
  }
  return typeof schedule.configType === 'string' && schedule.configType.length > 0
    ? schedule.configType
    : '—';
}

/**
 * Light cleanup of the timezone-ambiguous datetime strings Fabric returns:
 * "2026-10-01T08:00:00" → "2026-10-01 08:00". No zone conversion.
 */
export function formatScheduleDateTime(value: string | undefined): string {
  if (typeof value !== 'string' || value.length === 0) return '—';
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match ? `${match[1]} ${match[2]}` : value;
}
