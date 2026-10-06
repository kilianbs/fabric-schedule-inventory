//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useMemo, useState } from 'react';
import {
  CalendarCheck,
  Folder,
  MousePointerClick,
  Search,
  X,
} from 'lucide-react';

import { useCssTheme } from '@microsoft/fabric-visuals';
import { DataGrid } from '@microsoft/fabric-datagrid';
import type { GridColumnDef, Row } from '@microsoft/fabric-datagrid';
import type { InteractionEvent } from '@microsoft/fabric-visuals-core';
import type {
  ArtifactRecord,
  ScheduleRecord,
  SyncRunRecord,
} from '@rayfin-app/shared';

import { InventorySummary } from '@/components/inventory-summary.component';
import { ScheduleDetail } from '@/components/schedule-detail.component';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import {
  countBy,
  DEFAULT_FILTERS,
  filterArtifacts,
  isDefaultFilters,
} from '@/lib/filter-artifacts';
import type { ArtifactFilters } from '@/lib/filter-artifacts';
import { computeTotals } from '@/lib/inventory-totals';
import {
  cn,
  formatNumber,
  formatRelativeTime,
  formatTimestamp,
} from '@/lib/utils';

export type InventoryStatus = 'loading' | 'error' | 'ready';

export interface InventoryViewProps {
  status: InventoryStatus;
  errorMessage?: string;
  artifacts: ArtifactRecord[];
  schedulesByArtifact: Map<string, ScheduleRecord[]>;
  lastRun?: SyncRunRecord | null;
  onRetry?: () => void;
}

const FOCUS =
  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';

const CONTROL_CLASS = cn(
  'border-input bg-background text-foreground text-300 h-800 rounded-lg border px-300',
  FOCUS
);

const SECONDARY_BUTTON = cn(
  'border-border bg-background hover:bg-accent text-300 inline-flex h-800 items-center gap-200 rounded-lg border px-300 font-medium transition-[color,background-color,border-color,scale] duration-150 active:scale-95',
  FOCUS
);

/**
 * The artifact schedule inventory: global figures, filters and a DataGrid of
 * every schedulable artifact, with the selected row's schedules beside it.
 */
export function InventoryView({
  status,
  errorMessage,
  artifacts,
  schedulesByArtifact,
  lastRun = null,
  onRetry,
}: InventoryViewProps) {
  const theme = useCssTheme();
  const [filters, setFilters] = useState<ArtifactFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const updateFilter = <K extends keyof ArtifactFilters>(
    key: K,
    value: ArtifactFilters[K]
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const workspaceOptions = useMemo(
    () => countBy(artifacts, 'workspaceName'),
    [artifacts]
  );
  const typeOptions = useMemo(() => countBy(artifacts, 'itemType'), [artifacts]);

  const visibleArtifacts = useMemo(
    () => filterArtifacts(artifacts, filters),
    [artifacts, filters]
  );

  const columns = useMemo<GridColumnDef[]>(
    () => [
      {
        id: 'displayName',
        header: 'Artifact',
        sortable: true,
        minWidth: 240,
        cellRenderer: (value) => {
          const name = String(value ?? '');
          return (
            <span className="text-300 block truncate font-medium" title={name}>
              {name}
            </span>
          );
        },
      },
      {
        id: 'itemType',
        header: 'Type',
        sortable: true,
        filterable: true,
        minWidth: 150,
        cellRenderer: (value) => <TypeBadge value={String(value ?? '')} />,
      },
      {
        id: 'workspaceName',
        header: 'Workspace',
        sortable: true,
        filterable: true,
        minWidth: 180,
        cellRenderer: (value) => {
          const name = String(value ?? '');
          return (
            <span
              className="text-300 flex min-w-0 items-center gap-200 text-muted-foreground"
              title={name}
            >
              <Folder aria-hidden="true" className="icon-size-100 shrink-0" />
              <span className="truncate">{name}</span>
            </span>
          );
        },
      },
      {
        id: 'scheduleCount',
        header: 'Schedules',
        sortable: true,
        numericStyling: true,
        width: 110,
        cellRenderer: (value) => {
          const count = typeof value === 'number' ? value : 0;
          return count === 0 ? (
            <span className="text-300 text-muted-foreground">—</span>
          ) : (
            <span className="text-300 font-semibold tabular-nums">
              {formatNumber(count)}
            </span>
          );
        },
      },
      {
        id: 'disabledCount',
        header: 'Disabled',
        sortable: true,
        numericStyling: true,
        width: 110,
        cellRenderer: (value) => {
          const count = typeof value === 'number' ? value : 0;
          return count === 0 ? (
            <span className="text-300 text-muted-foreground">—</span>
          ) : (
            <span className="bg-destructive/10 text-destructive text-200 inline-flex items-center rounded-full px-300 py-100 font-semibold tabular-nums">
              {formatNumber(count)}
            </span>
          );
        },
      },
      {
        id: 'lastSynced',
        header: 'Last synced',
        width: 150,
        cellRenderer: (value, row) => (
          <span
            className="text-200 text-muted-foreground"
            title={String(row.lastSyncedFull ?? '')}
          >
            {String(value ?? '')}
          </span>
        ),
      },
      { id: 'lastSyncedFull', header: 'Last synced (full)', hidden: true },
    ],
    []
  );

  const rows = useMemo<Row[]>(
    () =>
      visibleArtifacts.map((artifact) => ({
        displayName: safeText(artifact.displayName),
        itemType: safeText(artifact.itemType),
        workspaceName: safeText(artifact.workspaceName),
        scheduleCount: artifact.scheduleCount,
        disabledCount: disabledCount(schedulesByArtifact.get(artifact.id)),
        lastSynced: formatRelativeTime(artifact.lastSyncedAt),
        lastSyncedFull: formatTimestamp(artifact.lastSyncedAt),
      })),
    [visibleArtifacts, schedulesByArtifact]
  );

  const byId = useMemo(() => {
    const map = new Map<string, ArtifactRecord>();
    for (const artifact of artifacts) map.set(artifact.id, artifact);
    return map;
  }, [artifacts]);

  const selected = selectedId === null ? null : (byId.get(selectedId) ?? null);
  const selectedSchedules =
    selected === null ? [] : (schedulesByArtifact.get(selected.id) ?? []);

  if (status === 'loading') return <LoadingState rows={6} />;
  if (status === 'error')
    return (
      <ErrorState
        message={errorMessage ?? 'The inventory could not be loaded.'}
        onRetry={onRetry}
      />
    );

  const filtersChanged = !isDefaultFilters(filters);
  const totals = computeTotals(artifacts, schedulesByArtifact);
  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  return (
    <main className="px-500 py-500">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-500">
        <header className="animate-fade-up flex flex-wrap items-end justify-between gap-300">
          <div>
            <p className="text-100 font-semibold uppercase tracking-widest text-muted-foreground">
              Schedule inventory
            </p>
            <h1 className="font-heading text-hero-800 mt-100 font-semibold tracking-tight">
              Artifact schedules
            </h1>
            <p className="text-300 mt-100 text-muted-foreground">
              Cadence, time zone, owner and state of every schedule on file
            </p>
          </div>
        </header>

        <InventorySummary totals={totals} lastRun={lastRun} />

        <section
          aria-label="Filters"
          className="border-border bg-card animate-fade-up flex flex-wrap items-end gap-300 rounded-2xl border p-400 shadow-sm [animation-delay:240ms]"
        >
          <div className="flex min-w-0 flex-1 basis-64 flex-col gap-100">
            <label
              htmlFor="artifact-search"
              className="text-200 text-muted-foreground"
            >
              Search
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="icon-size-200 pointer-events-none absolute top-1/2 left-300 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="artifact-search"
                type="search"
                placeholder="Artifact name…"
                value={filters.query}
                onChange={(event) => updateFilter('query', event.target.value)}
                className={cn(CONTROL_CLASS, 'w-full pr-800 pl-800')}
              />
              {filters.query !== '' ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => updateFilter('query', '')}
                  className={cn(
                    'hover:bg-accent animate-fade-in absolute top-1/2 right-100 inline-flex h-600 w-600 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground',
                    FOCUS
                  )}
                >
                  <X aria-hidden="true" className="icon-size-200" />
                </button>
              ) : null}
            </div>
          </div>
          <FilterSelect
            id="workspace-filter"
            label="Workspace"
            value={filters.workspace}
            onChange={(value) => updateFilter('workspace', value)}
            options={workspaceOptions}
          />
          <FilterSelect
            id="type-filter"
            label="Item type"
            value={filters.type}
            onChange={(value) => updateFilter('type', value)}
            options={typeOptions}
          />
          <button
            type="button"
            aria-pressed={filters.schedulesOnly}
            onClick={() => updateFilter('schedulesOnly', !filters.schedulesOnly)}
            className={cn(
              SECONDARY_BUTTON,
              filters.schedulesOnly &&
                'border-primary bg-primary/10 text-primary hover:bg-primary/15'
            )}
          >
            <CalendarCheck aria-hidden="true" className="icon-size-200" />
            With schedules only
          </button>
          {filtersChanged ? (
            <button
              type="button"
              onClick={clearFilters}
              className={cn(
                'text-primary text-300 hover:bg-primary/10 animate-fade-in inline-flex h-800 items-center gap-100 rounded-lg px-300 font-medium',
                FOCUS
              )}
            >
              <X aria-hidden="true" className="icon-size-200" />
              Clear filters
            </button>
          ) : null}
          <p
            className="text-200 ml-auto flex h-800 items-center tabular-nums text-muted-foreground"
            aria-live="polite"
          >
            <span className="font-semibold text-foreground">
              {formatNumber(visibleArtifacts.length)}
            </span>
            &nbsp;of {formatNumber(artifacts.length)} artifacts
          </p>
        </section>

        <div className="grid items-start gap-400 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {visibleArtifacts.length === 0 ? (
            filtersChanged || filters.schedulesOnly ? (
              <EmptyState
                title="No artifacts match the current filters"
                hint="Adjust the search or filters to see more artifacts."
                action={
                  <button
                    type="button"
                    onClick={() =>
                      setFilters({ ...DEFAULT_FILTERS, schedulesOnly: false })
                    }
                    className={SECONDARY_BUTTON}
                  >
                    <X aria-hidden="true" className="icon-size-200" />
                    Show all artifacts
                  </button>
                }
              />
            ) : (
              <EmptyState
                title="No schedulable artifacts on file"
                hint="Run a sync to populate the inventory."
              />
            )
          ) : (
            <div
              className="border-border bg-card animate-fade-up overflow-hidden rounded-2xl border shadow-sm [animation-delay:320ms]"
              data-testid="inventory-grid"
            >
              <DataGrid
                columns={columns}
                data={rows}
                theme={theme}
                pageSize={20}
                rowHeight={44}
                defaultSort={[{ columnId: 'scheduleCount', direction: 'desc' }]}
                onInteraction={(events: InteractionEvent[]) => {
                  const select = events.find(
                    (event) => event.action === 'select'
                  );
                  if (select?.selections.length === 1) {
                    // Selection predicates carry the row's visible cell values;
                    // resolve them back to the artifact they identify.
                    const values = new Map<string, unknown>();
                    for (const predicate of select.selections[0].predicates) {
                      if (predicate.type === 'set')
                        values.set(predicate.name, predicate.values[0]);
                    }
                    const displayName = values.get('displayName');
                    const workspaceName = values.get('workspaceName');
                    const match = visibleArtifacts.find(
                      (artifact) =>
                        safeText(artifact.displayName) === displayName &&
                        safeText(artifact.workspaceName) === workspaceName
                    );
                    if (match) {
                      setSelectedId(match.id);
                      return;
                    }
                  }
                  // A clear event (second click on the same row) deselects.
                  setSelectedId(null);
                }}
              />
            </div>
          )}

          {selected ? (
            <section
              key={selected.id}
              className="border-border bg-card animate-slide-in rounded-2xl border p-500 shadow-sm lg:sticky lg:top-400"
              aria-label="Schedule detail"
            >
              <div className="flex items-start justify-between gap-300">
                <div className="min-w-0">
                  <p className="text-100 text-primary font-semibold uppercase tracking-widest">
                    Schedule detail
                  </p>
                  <h2 className="font-heading text-500 mt-100 font-semibold break-words">
                    {safeText(selected.displayName)}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close detail"
                  onClick={() => setSelectedId(null)}
                  className={cn(
                    'hover:bg-accent inline-flex h-700 w-700 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,rotate] duration-200 hover:rotate-90',
                    FOCUS
                  )}
                >
                  <X aria-hidden="true" className="icon-size-200" />
                </button>
              </div>
              <div className="mt-200 flex flex-wrap items-center gap-200">
                <TypeBadge value={safeText(selected.itemType)} />
                <span className="text-200 inline-flex items-center gap-100 text-muted-foreground">
                  <Folder aria-hidden="true" className="icon-size-100" />
                  {safeText(selected.workspaceName)}
                </span>
              </div>
              <p className="text-200 mt-200 text-muted-foreground">
                {formatNumber(selectedSchedules.length)} schedule
                {selectedSchedules.length === 1 ? '' : 's'} ·{' '}
                {formatNumber(disabledCount(selectedSchedules))} disabled · job
                types probed: {safeText(selected.jobTypesProbed)}
              </p>
              <div className="border-border mt-400 border-t pt-400">
                {selectedSchedules.length === 0 ? (
                  <p className="text-300 text-muted-foreground">
                    No schedules found for this artifact.
                  </p>
                ) : (
                  <ScheduleDetail schedules={selectedSchedules} />
                )}
              </div>
            </section>
          ) : (
            <div className="border-border bg-card animate-fade-in flex flex-col items-center gap-200 rounded-2xl border border-dashed px-500 py-800 text-center lg:sticky lg:top-400">
              <MousePointerClick
                aria-hidden="true"
                className="icon-size-400 animate-bounce text-muted-foreground [animation-iteration-count:3]"
              />
              <p className="text-300 font-medium">No artifact selected</p>
              <p className="text-200 text-muted-foreground">
                Select a row to see its schedules.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function TypeBadge({ value }: { value: string }) {
  return (
    <span
      className="bg-muted text-200 inline-flex max-w-full items-center truncate rounded-md px-200 py-100 font-medium"
      title={value}
    >
      {value}
    </span>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; count: number }[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-100">
      <label htmlFor={id} className="text-200 text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(CONTROL_CLASS, 'max-w-64')}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {`${option.value} (${formatNumber(option.count)})`}
          </option>
        ))}
      </select>
    </div>
  );
}

function disabledCount(schedules: readonly ScheduleRecord[] | undefined) {
  return (schedules ?? []).filter((schedule) => !schedule.enabled).length;
}

/** Rows may predate optional fields; never interpolate raw values. */
function safeText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '—';
}
