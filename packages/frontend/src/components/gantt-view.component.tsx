import { useMemo, useState } from 'react';
import { TriangleAlert } from 'lucide-react';

import type {
  ArtifactRecord,
  JobRunRecord,
  ScheduleRecord,
} from '@rayfin-app/shared';

import {
  GanttGroupSection,
  LABEL_COLUMN,
} from '@/components/gantt-group.component';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { buildGantt, WEEKDAY_NAMES } from '@/lib/gantt';
import type { GroupBy } from '@/lib/gantt';
import { cn } from '@/lib/utils';

export interface GanttViewProps {
  status: 'loading' | 'error' | 'ready';
  errorMessage?: string;
  artifacts: ArtifactRecord[];
  schedulesByArtifact: Map<string, ScheduleRecord[]>;
  runs: JobRunRecord[];
}

const RUN_COUNT_OPTIONS = [1, 3, 5, 10, 20] as const;
const DEFAULT_RUN_COUNT = 5;

const FOCUS =
  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';
const CONTROL_CLASS = cn(
  'border-input bg-background text-foreground text-300 h-800 rounded-lg border px-300',
  FOCUS
);
const AXIS_HOURS = Array.from({ length: 12 }, (_, index) => index * 2);

/**
 * "Typical day" Gantt: one row per scheduled artifact, bars at the scheduled
 * times with the width of the average duration of the last N runs, grouped by
 * capacity or workspace so overlaps and load peaks stand out.
 */
export function GanttView({
  status,
  errorMessage,
  artifacts,
  schedulesByArtifact,
  runs,
}: GanttViewProps) {
  const [runCount, setRunCount] = useState<number>(DEFAULT_RUN_COUNT);
  const [weekday, setWeekday] = useState(() => new Date().getDay());
  const [groupBy, setGroupBy] = useState<GroupBy>('capacity');
  const [includeDisabled, setIncludeDisabled] = useState(false);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const model = useMemo(
    () =>
      buildGantt({
        artifacts,
        schedulesByArtifact,
        runs,
        runCount,
        weekday,
        groupBy,
        includeDisabled,
      }),
    [artifacts, schedulesByArtifact, runs, runCount, weekday, groupBy, includeDisabled]
  );

  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const maxLoad = Math.max(1, ...model.groups.map((group) => group.peak.count));
  const droppedEnded = model.skipped.filter((s) => s.reason === 'ended').length;
  const droppedMonthly = model.skipped.filter((s) => s.reason === 'monthly').length;
  const hasTruncated = model.groups.some((group) =>
    group.rows.some((row) => row.truncated)
  );

  return (
    <main className="px-500 py-500">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-400">
        <header className="animate-fade-up">
          <p className="text-100 font-semibold uppercase tracking-widest text-muted-foreground">
            Typical day
          </p>
          <h1 className="font-heading text-hero-800 mt-100 font-semibold tracking-tight">
            Schedule Gantt
          </h1>
          <p className="text-300 mt-100 text-muted-foreground">
            When scheduled artifacts start and how long they usually run, to
            spot overlaps and load peaks.
          </p>
        </header>

        <section
          aria-label="Gantt controls"
          className="border-border bg-card flex flex-wrap items-end gap-300 rounded-2xl border p-400 shadow-sm"
        >
          <div className="flex flex-col gap-100">
            <label htmlFor="gantt-runs" className="text-200 text-muted-foreground">
              Average of last N runs
            </label>
            <select
              id="gantt-runs"
              value={runCount}
              onChange={(event) => setRunCount(Number(event.target.value))}
              className={CONTROL_CLASS}
            >
              {RUN_COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-100">
            <label htmlFor="gantt-day" className="text-200 text-muted-foreground">
              Day of week
            </label>
            <select
              id="gantt-day"
              value={weekday}
              onChange={(event) => setWeekday(Number(event.target.value))}
              className={CONTROL_CLASS}
            >
              {WEEKDAY_NAMES.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-100">
            <span id="gantt-group-label" className="text-200 text-muted-foreground">
              Group by
            </span>
            <div
              role="group"
              aria-labelledby="gantt-group-label"
              className="border-border flex overflow-hidden rounded-lg border"
            >
              {(['capacity', 'workspace'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={groupBy === option}
                  onClick={() => setGroupBy(option)}
                  className={cn(
                    'text-300 h-800 px-400 font-medium capitalize',
                    FOCUS,
                    groupBy === option
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-accent'
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <label className="text-300 flex h-800 items-center gap-200">
            <input
              type="checkbox"
              checked={includeDisabled}
              onChange={(event) => setIncludeDisabled(event.target.checked)}
              className={cn('icon-size-200', FOCUS)}
            />
            Include disabled schedules
          </label>
        </section>

        {status === 'loading' ? <LoadingState rows={6} /> : null}
        {status === 'error' ? (
          <ErrorState
            message={errorMessage ?? 'Job run history could not be loaded.'}
          />
        ) : null}

        {status === 'ready' ? (
          <>
            <Notices
              messages={[
                runs.length === 0
                  ? 'No run history yet: bars use a placeholder width. Run a sync to collect recent job runs.'
                  : null,
                model.timeZones.length > 1
                  ? `Schedules use ${model.timeZones.length} time zones (${model.timeZones.join(', ')}). Each bar is shown in its own schedule's local time, not converted.`
                  : null,
                droppedMonthly > 0
                  ? `${droppedMonthly} monthly schedule${droppedMonthly === 1 ? ' is' : 's are'} not drawn.`
                  : null,
                droppedEnded > 0
                  ? `${droppedEnded} schedule${droppedEnded === 1 ? ' has' : 's have'} ended and ${droppedEnded === 1 ? 'is' : 'are'} not drawn.`
                  : null,
                hasTruncated
                  ? 'Very frequent schedules are capped at 288 bars per day.'
                  : null,
              ]}
            />
            {model.groups.length === 0 ? (
              <EmptyState
                title="Nothing to plot for this day"
                hint="No scheduled artifacts run on the selected day. Pick another day, include disabled schedules, or run a sync."
              />
            ) : (
              <div
                className="border-border bg-card animate-fade-up overflow-x-auto rounded-2xl border shadow-sm"
                data-testid="gantt-chart"
              >
                <div className="min-w-[64rem]">
                  <div className={cn('bg-card grid', LABEL_COLUMN)} aria-hidden="true">
                    <div className="bg-card sticky left-0 z-10 px-300 py-200 text-200 text-muted-foreground">
                      Artifact
                    </div>
                    <div className="relative h-600">
                      {AXIS_HOURS.map((hour) => (
                        <span
                          key={hour}
                          className="text-200 absolute top-200 -translate-x-1/2 text-muted-foreground tabular-nums first:translate-x-0"
                          style={{ left: `${(hour / 24) * 100}%` }}
                        >
                          {String(hour).padStart(2, '0')}:00
                        </span>
                      ))}
                    </div>
                  </div>
                  {model.groups.map((group) => (
                    <GanttGroupSection
                      key={`${groupBy}:${group.key}`}
                      group={group}
                      maxLoad={maxLoad}
                      expanded={!collapsed.has(`${groupBy}:${group.key}`)}
                      onToggle={() => toggle(`${groupBy}:${group.key}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

function Notices({ messages }: { messages: readonly (string | null)[] }) {
  const shown = messages.filter((message): message is string => message !== null);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col gap-200">
      {shown.map((message) => (
        <p
          key={message}
          role="status"
          className="border-border bg-card text-300 flex items-start gap-200 rounded-xl border px-400 py-300"
        >
          <TriangleAlert
            aria-hidden="true"
            className="icon-size-200 mt-100 shrink-0 text-muted-foreground"
          />
          {message}
        </p>
      ))}
    </div>
  );
}
