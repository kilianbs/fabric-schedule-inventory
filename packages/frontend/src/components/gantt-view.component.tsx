import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

import type {
  ArtifactRecord,
  JobRunRecord,
  ScheduleRecord,
} from '@rayfin-app/shared';

import {
  GanttAxis,
  GanttGroupSection,
  NowLine,
} from '@/components/gantt-group.component';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { GanttFilter } from '@/components/gantt-filter.component';
import { ItemTypeIcon } from '@/components/item-type.component';
import { WarningEmoji } from '@/components/warning-emoji.component';
import {
  buildGantt,
  countUnresolvedCapacities,
  filterArtifacts,
  filterOptions,
  itemTypeSlot,
  WEEKDAY_NAMES,
} from '@/lib/gantt';
import type { GroupBy } from '@/lib/gantt';
import { HATCH, SERIES_BG } from '@/lib/gantt-style';
import { cn, formatNumber } from '@/lib/utils';

interface FilterChip {
  kind: 'Capacity' | 'Workspace';
  key: string;
  label: string;
}

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

  const [filters, setFilters] = useState<{
    capacities: string[];
    workspaces: string[];
  }>({ capacities: [], workspaces: [] });

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
        filters,
      }),
    [
      artifacts,
      schedulesByArtifact,
      runs,
      runCount,
      weekday,
      groupBy,
      includeDisabled,
      filters,
    ]
  );
  const options = useMemo(
    () => filterOptions(artifacts, filters),
    [artifacts, filters]
  );
  const allWorkspaces = useMemo(
    () => filterOptions(artifacts, {}).workspaces,
    [artifacts]
  );
  const filteredCount = useMemo(
    () => filterArtifacts(artifacts, filters).length,
    [artifacts, filters]
  );
  const chips: FilterChip[] = [
    ...filters.capacities.map((key) => ({
      kind: 'Capacity' as const,
      key,
      label: options.capacities.find((o) => o.key === key)?.label ?? key,
    })),
    ...filters.workspaces.map((key) => ({
      kind: 'Workspace' as const,
      key,
      label: allWorkspaces.find((o) => o.key === key)?.label ?? key,
    })),
  ];
  const itemTypes = useMemo(
    () =>
      Array.from(
        new Set(
          model.groups.flatMap((group) =>
            group.rows.map((row) => row.artifact.itemType ?? '')
          )
        )
      ).sort(),
    [model]
  );
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  // "Now" is the browser's clock; schedules may use other zones (see notices).
  const nowMin =
    weekday === now.getDay() ? now.getHours() * 60 + now.getMinutes() : null;
  const clearFilters = () => setFilters({ capacities: [], workspaces: [] });
  const removeChip = (chip: FilterChip) =>
    setFilters((current) =>
      chip.kind === 'Capacity'
        ? { ...current, capacities: current.capacities.filter((k) => k !== chip.key) }
        : { ...current, workspaces: current.workspaces.filter((k) => k !== chip.key) }
    );

  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const unresolvedCapacities = useMemo(
    () => countUnresolvedCapacities(artifacts),
    [artifacts]
  );
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
          <div className="flex flex-col gap-100">
            <span className="text-200 text-muted-foreground">Filter</span>
            <div className="flex flex-wrap gap-200">
              <GanttFilter
                label="Capacity"
                options={options.capacities}
                selected={filters.capacities}
                onChange={(capacities) =>
                  setFilters((current) => ({ ...current, capacities }))
                }
              />
              <GanttFilter
                label="Workspace"
                options={options.workspaces}
                selected={filters.workspaces}
                onChange={(workspaces) =>
                  setFilters((current) => ({ ...current, workspaces }))
                }
              />
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

        <div className="text-300 flex flex-wrap items-center gap-200 text-muted-foreground">
          <span>
            {formatNumber(filteredCount)} of {formatNumber(artifacts.length)}{' '}
            artifacts
          </span>
          {chips.map((chip) => (
            <button
              key={`${chip.kind}:${chip.key}`}
              type="button"
              aria-label={`Remove filter ${chip.label}`}
              onClick={() => removeChip(chip)}
              className={cn(
                'border-border bg-card text-foreground text-200 hover:bg-accent flex items-center gap-100 rounded-full border py-100 pr-200 pl-300',
                FOCUS
              )}
            >
              <span className="text-muted-foreground">{chip.kind}:</span>
              {chip.label}
              <X aria-hidden="true" className="icon-size-200" />
            </button>
          ))}
          {chips.length > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className={cn(
                'text-200 rounded-md px-200 py-100 font-medium underline underline-offset-2',
                FOCUS
              )}
            >
              Clear all
            </button>
          ) : null}
        </div>

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
                unresolvedCapacities > 0
                  ? `Capacity names are unavailable for ${unresolvedCapacities} capacit${unresolvedCapacities === 1 ? 'y' : 'ies'}, shown by id. Names resolve only when the app identity has Admin or Contributor access to the capacity.`
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
            {model.groups.length === 0 && chips.length > 0 ? (
              <EmptyState
                title="No artifacts match the filters"
                hint="Nothing scheduled on the selected day matches the active capacity and workspace filters."
                action={
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={cn(
                      'border-input bg-background text-300 hover:bg-accent h-700 rounded-lg border px-400 font-medium',
                      FOCUS
                    )}
                  >
                    Clear filters
                  </button>
                }
              />
            ) : model.groups.length === 0 ? (
              <EmptyState
                title="Nothing to plot for this day"
                hint="No scheduled artifacts run on the selected day. Pick another day, include disabled schedules, or run a sync."
              />
            ) : (
              <>
                <Legend itemTypes={itemTypes} />
                <div
                  className="border-border bg-card animate-fade-up max-h-[75vh] overflow-auto rounded-2xl border shadow-sm"
                  data-testid="gantt-chart"
                >
                  <div className="relative min-w-[64rem]">
                    <GanttAxis nowMin={nowMin} />
                    {model.groups.map((group) => (
                      <GanttGroupSection
                        key={`${groupBy}:${group.key}`}
                        group={group}
                        maxLoad={maxLoad}
                        runCount={runCount}
                        expanded={!collapsed.has(`${groupBy}:${group.key}`)}
                        onToggle={() => toggle(`${groupBy}:${group.key}`)}
                      />
                    ))}
                    <NowLine nowMin={nowMin} />
                  </div>
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

function Legend({ itemTypes }: { itemTypes: readonly string[] }) {
  return (
    <ul
      aria-label="Legend"
      className="text-200 flex flex-wrap items-center gap-x-400 gap-y-100 text-muted-foreground"
    >
      {itemTypes.map((type) => (
        <li key={type} className="flex items-center gap-100">
          <span
            aria-hidden="true"
            className={cn('h-300 w-500 rounded-sm', SERIES_BG[itemTypeSlot(type)])}
          />
          <ItemTypeIcon itemType={type} />
          {type || 'Item'}
        </li>
      ))}
      <li className="flex items-center gap-100">
        <span
          aria-hidden="true"
          className="bg-muted h-300 w-500 rounded-sm border border-dashed border-muted-foreground"
          style={HATCH}
        />
        No run history
      </li>
      <li className="flex items-center gap-100">
        <span
          aria-hidden="true"
          className="ring-destructive bg-series-1 h-300 w-500 rounded-sm ring-2"
        />
        Last run failed
      </li>
    </ul>
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
          className="border-warning-border bg-warning text-warning-foreground text-300 flex items-start gap-300 rounded-xl border px-400 py-300"
        >
          <WarningEmoji />
          <span className="pt-100-nudge">{message}</span>
        </p>
      ))}
    </div>
  );
}
