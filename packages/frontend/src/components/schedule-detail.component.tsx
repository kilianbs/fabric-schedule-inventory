//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Clock, Copy } from 'lucide-react';

import type { ScheduleRecord } from '@rayfin-app/shared';

import {
  describeSchedule,
  formatScheduleDateTime,
} from '@/lib/schedule-format';
import { cn } from '@/lib/utils';

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
    <ul className="flex flex-col gap-300">
      {schedules.map((schedule, index) => (
        <li
          key={schedule.id}
          className={cn(
            'border-border bg-background animate-fade-up rounded-xl border p-400 transition-colors hover:border-primary/40',
            !schedule.enabled && 'border-dashed'
          )}
          // Stagger after the panel slides in; cap so long lists stay snappy.
          style={{ animationDelay: `${120 + Math.min(index, 6) * 50}ms` }}
        >
          <header className="flex flex-wrap items-center justify-between gap-200">
            <h3 className="text-300 font-semibold">
              {safeText(schedule.jobType)}
            </h3>
            <ScheduleBadge enabled={schedule.enabled} />
          </header>
          <p className="text-300 mt-200 flex items-center gap-200">
            <Clock
              aria-hidden="true"
              className="icon-size-200 shrink-0 text-muted-foreground"
            />
            <span className="font-medium">{describeSchedule(schedule)}</span>
          </p>
          <dl className="text-200 mt-300 grid grid-cols-[auto_1fr] gap-x-400 gap-y-100">
            <Detail term="Starts">
              {formatScheduleDateTime(schedule.startDateTime)}
            </Detail>
            <Detail term="Ends">
              {formatScheduleDateTime(schedule.endDateTime)}
            </Detail>
            <Detail term="Time zone">
              {safeText(schedule.localTimeZoneId)}
            </Detail>
            <Detail term="Created">
              {formatScheduleDateTime(schedule.createdDateTime)}
            </Detail>
            <Detail term="Owner">{safeText(schedule.ownerType)}</Detail>
            {schedule.ownerId ? (
              <Detail term={`${safeText(schedule.ownerType)} ID`}>
                <IdText
                  value={schedule.ownerId}
                  label={`${safeText(schedule.ownerType).toLowerCase()} ID`}
                />
              </Detail>
            ) : null}
            <Detail term="Schedule ID">
              <IdText value={schedule.scheduleFabricId} label="schedule ID" />
            </Detail>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function ScheduleBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        'text-200 inline-flex items-center gap-200 rounded-full px-300 py-100 font-medium',
        enabled
          ? 'bg-primary/10 text-primary'
          : 'bg-destructive/10 text-destructive'
      )}
    >
      <span aria-hidden="true" className="h-100 w-100 rounded-full bg-current" />
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
}

/** Full identifier (wraps rather than truncating) with a copy button. */
function IdText({ value, label }: { value: string | undefined; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (typeof value !== 'string' || value.length === 0)
    return <span className="text-muted-foreground">—</span>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (e.g. inside an embedding frame); the ID
      // stays selectable, so there is nothing else to do.
    }
  };

  return (
    <span className="flex min-w-0 items-start gap-100">
      <code className="font-monospace min-w-0 break-all text-muted-foreground select-all">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
        title={copied ? 'Copied' : 'Copy'}
        className="hover:bg-accent focus-visible:ring-ring -my-100 inline-flex h-500 w-500 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:outline-none"
      >
        {copied ? (
          <Check aria-hidden="true" className="icon-size-100 text-primary" />
        ) : (
          <Copy aria-hidden="true" className="icon-size-100" />
        )}
      </button>
    </span>
  );
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function safeText(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  return '—';
}
