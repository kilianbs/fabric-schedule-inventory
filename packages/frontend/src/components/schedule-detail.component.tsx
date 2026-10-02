//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ScheduleRecord } from '@rayfin-app/shared';

/**
 * Renders the schedules of one artifact. Every value crossing into JSX is
 * treated as untrusted display input: optional fields may be missing,
 * datetimes are timezone-ambiguous strings rendered next to their time zone,
 * and JSON columns are parsed defensively.
 */
export function ScheduleDetail({
  schedules,
}: {
  schedules: readonly ScheduleRecord[];
}) {
  return (
    <div className="space-y-300">
      {schedules.map((schedule) => (
        <article
          key={schedule.id}
          className="border-border bg-background rounded-xl border p-400"
        >
          <header className="mb-300 flex flex-wrap items-center gap-300">
            <ScheduleBadge enabled={schedule.enabled} />
            <h3 className="text-300 font-semibold">
              {safeText(schedule.jobType)} · {safeText(schedule.configType)}
            </h3>
          </header>
          <dl className="text-200 grid grid-cols-[auto_1fr] gap-x-400 gap-y-100">
            <Detail term="Starts">{safeText(schedule.startDateTime)}</Detail>
            <Detail term="Ends">{safeText(schedule.endDateTime)}</Detail>
            <Detail term="Time zone">
              {safeText(schedule.localTimeZoneId)}
            </Detail>
            {typeof schedule.intervalMinutes === 'number' ? (
              <Detail term="Interval">
                {`every ${schedule.intervalMinutes} min`}
              </Detail>
            ) : null}
            <Detail term="Times">{joinList(parseJson(schedule.timesJson))}</Detail>
            <Detail term="Weekdays">
              {joinList(parseJson(schedule.weekdaysJson))}
            </Detail>
            <Detail term="Monthly">
              {describeMonthly(schedule.monthlyConfigJson)}
            </Detail>
            <Detail term="Created">
              {safeText(schedule.createdDateTime)}
            </Detail>
            <Detail term="Owner">
              {`${safeText(schedule.ownerType)}${
                schedule.ownerId ? ` (${shortId(schedule.ownerId)})` : ''
              }`}
            </Detail>
            <Detail term="Schedule ID">
              {shortId(schedule.scheduleFabricId)}
            </Detail>
          </dl>
        </article>
      ))}
    </div>
  );
}

function ScheduleBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`text-200 inline-flex items-center gap-200 rounded-full px-300 py-100 font-medium ${
        enabled
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      <span aria-hidden="true" className="h-100 w-100 rounded-full bg-current" />
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
}

function Detail({
  term,
  children,
}: {
  term: string;
  children: string;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="col-span-1 break-words">{children}</dd>
    </>
  );
}

/** Parse a JSON column defensively; bad or missing values render as unknown. */
function parseJson(value: string | undefined): string[] | null {
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

function describeMonthly(value: string | undefined): string {
  if (typeof value !== 'string' || value.length === 0) return '—';
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return '—';
    const record = parsed as { occurrence?: unknown; recurrence?: unknown };
    const parts: string[] = [];
    if (typeof record.recurrence === 'number')
      parts.push(`every ${record.recurrence} month(s)`);
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

function joinList(values: string[] | null): string {
  if (values === null) return '—';
  return values.length === 0 ? '—' : values.join(', ');
}

function shortId(value: string): string {
  return typeof value === 'string' && value.length > 8
    ? `${value.slice(0, 8)}…`
    : safeText(value);
}

function safeText(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  return '—';
}
