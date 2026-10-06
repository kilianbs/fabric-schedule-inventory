import { ChevronRight } from 'lucide-react';

import { formatClock, formatDuration, MINUTES_PER_DAY } from '@/lib/gantt';
import type { GanttBar, GanttGroup, GanttRow } from '@/lib/gantt';
import { cn, formatNumber } from '@/lib/utils';

const FOCUS =
  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';

/** Width of the sticky label column; the same value is used by the axis. */
export const LABEL_COLUMN = 'grid-cols-[15rem_minmax(0,1fr)]';

const HOUR_GRID = {
  backgroundImage:
    'repeating-linear-gradient(to right, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent calc(100% / 24))',
} as const;

const HATCH = {
  backgroundImage:
    'repeating-linear-gradient(45deg, transparent 0, transparent 3px, var(--color-muted-foreground) 3px, var(--color-muted-foreground) 4px)',
} as const;

/** The load strip is drawn in 15-minute cells. */
const STRIP_CELLS = 96;
const CELL_MINUTES = MINUTES_PER_DAY / STRIP_CELLS;

export interface GanttGroupProps {
  group: GanttGroup;
  /** Highest concurrency across all groups; scales the load strip. */
  maxLoad: number;
  expanded: boolean;
  onToggle: () => void;
}

/** One collapsible group: header, load strip and one timeline row per artifact. */
export function GanttGroupSection({
  group,
  maxLoad,
  expanded,
  onToggle,
}: GanttGroupProps) {
  const headingId = `gantt-group-${group.key || 'none'}`;
  return (
    <section aria-labelledby={headingId} className="border-border border-t">
      <div className={cn('grid', LABEL_COLUMN)}>
        <h3 id={headingId} className="bg-card sticky left-0 z-10 min-w-0">
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
              <span className="block truncate font-semibold">{group.label}</span>
              <span className="text-200 block font-normal text-muted-foreground">
                {formatNumber(group.rows.length)} artifact
                {group.rows.length === 1 ? '' : 's'} · peak {group.peak.count} at{' '}
                {formatClock(group.peak.minute)}
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
  return (
    <div
      className="flex items-center px-0"
      role="img"
      aria-label={`Concurrent runs across the day, peak ${group.peak.count}`}
    >
      <div className="flex h-500 w-full overflow-hidden rounded-md bg-muted">
        {cells.map((count, index) => (
          <div
            key={index}
            title={
              count > 0
                ? `${formatClock(index * CELL_MINUTES)}: ${count} concurrent`
                : undefined
            }
            className={cn('h-full flex-1', count > 1 ? 'bg-destructive' : 'bg-primary')}
            style={{ opacity: count === 0 ? 0 : 0.25 + (0.75 * count) / maxLoad }}
          />
        ))}
      </div>
    </div>
  );
}

function GanttRowItem({
  row,
  overlapping,
}: {
  row: GanttRow;
  overlapping: boolean;
}) {
  const summary = row.hasHistory
    ? `avg ${formatDuration(row.averageDurationSeconds)} · last ${row.runsUsed} run${row.runsUsed === 1 ? '' : 's'}`
    : 'no run history';
  return (
    <li className={cn('border-border grid border-t border-dashed', LABEL_COLUMN)}>
      <div className="bg-card sticky left-0 z-10 min-w-0 py-200 pr-200 pl-800">
        <p className="text-300 truncate font-medium" title={row.artifact.displayName}>
          {row.artifact.displayName}
        </p>
        <p className="text-200 truncate text-muted-foreground">
          {summary}
          {overlapping ? ' · overlaps' : ''}
        </p>
      </div>
      <div className="relative min-h-700 py-100" style={HOUR_GRID}>
        {row.bars.map((bar, index) => (
          <Bar key={index} bar={bar} row={row} />
        ))}
      </div>
    </li>
  );
}

function Bar({ bar, row }: { bar: GanttBar; row: GanttRow }) {
  const label = `${row.artifact.displayName}: ${formatClock(bar.startMin)}, ${
    bar.hasHistory
      ? `avg ${formatDuration(row.averageDurationSeconds)} over ${row.runsUsed} run${row.runsUsed === 1 ? '' : 's'}`
      : 'no run history (placeholder width)'
  }${bar.wraps ? ', continues past midnight' : ''}`;
  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'absolute top-1/2 h-400 -translate-y-1/2 rounded-sm',
        bar.hasHistory
          ? 'bg-primary'
          : 'border-muted-foreground bg-muted border border-dashed'
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
