import { ChevronRight } from 'lucide-react';

import { TooltipTarget } from '@/components/gantt-tooltip.component';
import {
  capacityInfo,
  formatBarRange,
  formatClock,
  formatDuration,
  itemTypeSlot,
  MINUTES_PER_DAY,
  runningIn,
} from '@/lib/gantt';
import type { GanttBar, GanttGroup, GanttRow } from '@/lib/gantt';
import { HATCH, SERIES_BG } from '@/lib/gantt-style';
import { rovingKeyDown } from '@/lib/roving';
import { describeSchedule, formatScheduleDateTime } from '@/lib/schedule-format';
import { cn, formatNumber } from '@/lib/utils';

const FOCUS =
  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';

/** Width of the sticky label column; the same value is used by the axis. */
export const LABEL_COLUMN = 'grid-cols-[15rem_minmax(0,1fr)]';

/** Light hourly lines plus stronger lines every 6 hours. */
const HOUR_GRID = {
  backgroundImage: [
    'repeating-linear-gradient(to right, color-mix(in srgb, var(--color-foreground) 28%, transparent) 0, color-mix(in srgb, var(--color-foreground) 28%, transparent) 1px, transparent 1px, transparent 25%)',
    'repeating-linear-gradient(to right, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent calc(100% / 24))',
  ].join(', '),
} as const;

/** The load strip is drawn in 15-minute cells. */
const STRIP_CELLS = 96;
const CELL_MINUTES = MINUTES_PER_DAY / STRIP_CELLS;

export interface GanttGroupProps {
  group: GanttGroup;
  /** Highest concurrency across all groups; scales the load strip. */
  maxLoad: number;
  /** The N the user picked, shown as "runs used of N" in tooltips. */
  runCount: number;
  expanded: boolean;
  onToggle: () => void;
}

/** One collapsible group: header, load strip and one timeline row per artifact. */
export function GanttGroupSection({
  group,
  maxLoad,
  runCount,
  expanded,
  onToggle,
}: GanttGroupProps) {
  const headingId = `gantt-group-${group.key || 'none'}`;
  return (
    <section aria-labelledby={headingId} className="border-border border-t">
      <div className={cn('bg-muted/40 grid', LABEL_COLUMN)}>
        <h3 id={headingId} className="sticky left-0 z-10 min-w-0 bg-muted">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={onToggle}
            className={cn(
              'hover:bg-accent text-300 flex w-full items-start gap-200 px-300 py-300 text-left',
              FOCUS
            )}
          >
            <ChevronRight
              aria-hidden="true"
              className={cn(
                'icon-size-200 mt-100 shrink-0 transition-transform duration-150',
                expanded && 'rotate-90'
              )}
            />
            <span className="min-w-0">
              <span className="block truncate font-semibold">
                {group.label}
                {group.nameUnavailable ? ' ' : null}
                {group.nameUnavailable ? (
                  <span className="text-200 font-normal text-muted-foreground">
                    name unavailable
                  </span>
                ) : null}
              </span>
              <span className="text-200 block font-normal text-muted-foreground">
                {formatNumber(group.rows.length)} artifact
                {group.rows.length === 1 ? '' : 's'} · peak {group.peak.count} at{' '}
                {formatClock(group.peak.minute)}
                {group.overlapping.length > 0
                  ? ` · ${group.overlapping.length} overlapping`
                  : ''}
              </span>
            </span>
          </button>
        </h3>
        <LoadStrip group={group} maxLoad={maxLoad} />
      </div>
      {expanded ? (
        <ul>
          {group.rows.map((row) => (
            <GanttRowItem
              key={row.artifact.id}
              row={row}
              runCount={runCount}
              overlapping={group.overlapping.includes(row.artifact.id)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function LoadStrip({ group, maxLoad }: { group: GanttGroup; maxLoad: number }) {
  const cells = Array.from({ length: STRIP_CELLS }, (_, index) => {
    const from = index * CELL_MINUTES;
    return Math.max(...group.load.slice(from, from + CELL_MINUTES));
  });
  const firstBusy = cells.findIndex((count) => count > 0);
  return (
    <div
      className="flex items-center px-0"
      role="group"
      aria-label={`Concurrent runs across the day, peak ${group.peak.count}`}
      onKeyDown={rovingKeyDown}
    >
      <div className="flex h-500 w-full rounded-md bg-muted">
        {cells.map((count, index) => {
          const from = index * CELL_MINUTES;
          const color = count > 1 ? 'bg-destructive' : 'bg-primary';
          const style = {
            opacity: count === 0 ? 0 : 0.25 + (0.75 * count) / maxLoad,
          };
          if (count === 0)
            return <div key={index} className="h-full flex-1" style={style} />;
          return (
            <TooltipTarget
              key={index}
              tabIndex={index === firstBusy ? 0 : -1}
              aria-label={`${formatClock(from)} to ${formatClock(from + CELL_MINUTES)}: ${count} concurrent`}
              tip={<StripTip group={group} from={from} count={count} />}
              className="h-full flex-1 hover:brightness-110 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className={cn('block h-full w-full', color)} style={style} />
            </TooltipTarget>
          );
        })}
      </div>
    </div>
  );
}

function StripTip({
  group,
  from,
  count,
}: {
  group: GanttGroup;
  from: number;
  count: number;
}) {
  const { names, extra } = runningIn(group, from, from + CELL_MINUTES);
  return (
    <div className="text-200 flex flex-col gap-100">
      <p className="text-300 font-semibold tabular-nums">
        {formatClock(from)}–{formatClock((from + CELL_MINUTES) % MINUTES_PER_DAY)}
      </p>
      <p className={count > 1 ? 'text-destructive font-medium' : undefined}>
        {count} concurrent
      </p>
      <ul className="list-disc pl-400">
        {names.map((name, index) => (
          <li key={`${name}:${index}`}>{name}</li>
        ))}
      </ul>
      {extra > 0 ? <p className="text-muted-foreground">+{extra} more</p> : null}
    </div>
  );
}

function GanttRowItem({
  row,
  runCount,
  overlapping,
}: {
  row: GanttRow;
  runCount: number;
  overlapping: boolean;
}) {
  const summary = row.hasHistory
    ? `avg ${formatDuration(row.averageDurationSeconds)} · last ${row.runsUsed} run${row.runsUsed === 1 ? '' : 's'}`
    : 'no run history';
  return (
    <li
      className={cn(
        'border-border bg-card odd:bg-secondary grid border-t border-dashed',
        LABEL_COLUMN
      )}
    >
      <div className="sticky left-0 z-10 min-w-0 bg-inherit py-200 pr-200 pl-800">
        <p className="text-300 truncate font-medium" title={row.artifact.displayName}>
          {row.artifact.displayName}
        </p>
        <p className="text-200 truncate text-muted-foreground">
          {summary}
          {overlapping ? ' · overlaps' : ''}
        </p>
      </div>
      <div
        className="relative min-h-700 py-100"
        style={HOUR_GRID}
        onKeyDown={rovingKeyDown}
      >
        {row.bars.map((bar, index) => (
          <Bar key={index} bar={bar} row={row} runCount={runCount} first={index === 0} />
        ))}
      </div>
    </li>
  );
}

function Bar({
  bar,
  row,
  runCount,
  first,
}: {
  bar: GanttBar;
  row: GanttRow;
  runCount: number;
  first: boolean;
}) {
  const label = `${row.artifact.displayName}: ${formatClock(bar.startMin)}, ${
    bar.hasHistory
      ? `avg ${formatDuration(row.averageDurationSeconds)} over ${row.runsUsed} run${row.runsUsed === 1 ? '' : 's'}`
      : 'no run history (placeholder width)'
  }${bar.wraps ? ', continues past midnight' : ''}`;
  const failed = row.lastRun?.status.toLowerCase() === 'failed';
  return (
    <TooltipTarget
      role="img"
      aria-label={label}
      tabIndex={first ? 0 : -1}
      tip={<BarTip bar={bar} row={row} runCount={runCount} />}
      className={cn(
        'absolute top-1/2 h-400 -translate-y-1/2 rounded-sm transition-[filter] duration-150 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none',
        bar.hasHistory
          ? SERIES_BG[itemTypeSlot(row.artifact.itemType ?? '')]
          : 'border-muted-foreground bg-muted border border-dashed',
        failed && 'ring-destructive ring-2'
      )}
      style={{
        left: `${(bar.startMin / MINUTES_PER_DAY) * 100}%`,
        width: `${(bar.durationMin / MINUTES_PER_DAY) * 100}%`,
        minWidth: 4,
        ...(bar.hasHistory ? {} : HATCH),
      }}
    />
  );
}

function BarTip({
  bar,
  row,
  runCount,
}: {
  bar: GanttBar;
  row: GanttRow;
  runCount: number;
}) {
  const { artifact } = row;
  const schedule = row.schedules.find((s) => s.id === bar.scheduleId);
  const range = formatBarRange(bar, row.averageDurationSeconds);
  const capacity = capacityInfo(artifact);
  const failed = row.lastRun?.status.toLowerCase() === 'failed';
  const rows: [string, string][] = [
    ['Workspace', artifact.workspaceName || artifact.workspaceId || '—'],
    [
      'Capacity',
      capacity.nameKnown ? capacity.label : `${capacity.label} (name unavailable)`,
    ],
    [
      'Schedule',
      schedule
        ? `${describeSchedule(schedule)}${schedule.localTimeZoneId ? ` (${schedule.localTimeZoneId})` : ''}`
        : '—',
    ],
    [
      'Time',
      `${range.text}${range.wraps ? ' (continues past midnight)' : ''}`,
    ],
  ];
  if (row.hasHistory) {
    rows.push([
      'Avg duration',
      `${formatDuration(row.averageDurationSeconds)} · ${row.runsUsed} of ${runCount} runs`,
    ]);
    if (row.runsUsed > 1)
      rows.push([
        'Min / max',
        `${formatDuration(row.minDurationSeconds)} / ${formatDuration(row.maxDurationSeconds)}`,
      ]);
  }
  rows.push([
    'Last run',
    row.lastRun
      ? `${row.lastRun.status} · ${formatScheduleDateTime(row.lastRun.startTimeUtc)} UTC`
      : 'none recorded',
  ]);
  rows.push(['State', schedule?.enabled === false ? 'Disabled' : 'Enabled']);

  return (
    <div className="text-200 flex flex-col gap-100">
      <div>
        <p className="text-300 font-semibold">{artifact.displayName}</p>
        <p className="text-muted-foreground">{artifact.itemType || 'Item'}</p>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-300 gap-y-100">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd
              className={cn(
                'min-w-0 break-words',
                term === 'Last run' && failed && 'text-destructive font-medium'
              )}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {row.hasHistory ? null : (
        <p className="border-border text-muted-foreground border-t pt-100">
          No run history: the bar uses a placeholder width.
        </p>
      )}
    </div>
  );
}

/** Time axis header: hour ticks, stronger ticks every 6 h, labels every 2 h. */
const AXIS_HOURS = Array.from({ length: 12 }, (_, index) => index * 2);
const TICK_HOURS = Array.from({ length: 24 }, (_, index) => index);

export function GanttAxis({ nowMin }: { nowMin: number | null }) {
  return (
    <div
      className={cn('border-border bg-card sticky top-0 z-20 grid border-b', LABEL_COLUMN)}
      aria-hidden="true"
    >
      <div className="bg-card text-200 sticky left-0 z-30 px-300 py-200 text-muted-foreground">
        Artifact
      </div>
      <div className="relative h-600">
        {TICK_HOURS.map((hour) => (
          <span
            key={hour}
            className={cn(
              'absolute bottom-0 w-px',
              hour % 6 === 0 ? 'bg-foreground/50 h-300' : 'bg-border h-100'
            )}
            style={{ left: `${(hour / 24) * 100}%` }}
          />
        ))}
        {AXIS_HOURS.map((hour) => (
          <span
            key={hour}
            className={cn(
              'text-200 absolute top-100 -translate-x-1/2 tabular-nums first:translate-x-0',
              hour % 6 === 0
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground'
            )}
            style={{ left: `${(hour / 24) * 100}%` }}
          >
            {String(hour).padStart(2, '0')}:00
          </span>
        ))}
        {nowMin === null ? null : (
          <span
            className="bg-primary text-primary-foreground text-200 absolute bottom-0 -translate-x-1/2 rounded-sm px-100 font-semibold tabular-nums"
            style={{ left: `${(nowMin / MINUTES_PER_DAY) * 100}%` }}
          >
            Now {formatClock(nowMin)}
          </span>
        )}
      </div>
    </div>
  );
}

/** Vertical "now" line over the timeline column; only for today's weekday. */
export function NowLine({ nowMin }: { nowMin: number | null }) {
  if (nowMin === null) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 left-[15rem] z-10"
    >
      <div
        className="bg-primary/70 absolute inset-y-0 w-px"
        style={{ left: `${(nowMin / MINUTES_PER_DAY) * 100}%` }}
      />
    </div>
  );
}
