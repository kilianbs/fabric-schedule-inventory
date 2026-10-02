//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useMemo, useState } from 'react';

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
import { computeTotals } from '@/lib/inventory-totals';
import { cn, formatNumber, formatTimestamp } from '@/lib/utils';

export type InventoryStatus = 'loading' | 'error' | 'ready';

export interface InventoryViewProps {
  status: InventoryStatus;
  errorMessage?: string;
  artifacts: ArtifactRecord[];
  schedulesByArtifact: Map<string, ScheduleRecord[]>;
  lastRun?: SyncRunRecord | null;
  onRetry?: () => void;
}

const CONTROL_CLASS =
  'border-input bg-background text-foreground focus-visible:ring-ring rounded-lg border px-300 py-200 text-300 focus-visible:ring-2 focus-visible:outline-none';

/**
 * The artifact schedule inventory: global figures, filters and a DataGrid of
 * every schedulable artifact, with a selected row's schedules below the grid.
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
  const [workspaceFilter, setWorkspaceFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [schedulesOnly, setSchedulesOnly] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const workspaceOptions = useMemo(
    () =>
      Array.from(
        new Set(artifacts.map((artifact) => artifact.workspaceName))
      ).sort((a, b) => a.localeCompare(b)),
    [artifacts]
  );
  const typeOptions = useMemo(
    () =>
      Array.from(new Set(artifacts.map((artifact) => artifact.itemType))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [artifacts]
  );

  const visibleArtifacts = useMemo(
    () =>
      artifacts.filter(
        (artifact) =>
          (workspaceFilter === '' ||
            artifact.workspaceName === workspaceFilter) &&
          (typeFilter === '' || artifact.itemType === typeFilter) &&
          (!schedulesOnly || artifact.scheduleCount > 0)
      ),
    [artifacts, workspaceFilter, typeFilter, schedulesOnly]
  );

  const columns = useMemo<GridColumnDef[]>(
    () => [
      {
        id: 'displayName',
        header: 'Artifact',
        sortable: true,
        minWidth: 240,
        cellRenderer: (value) => (
          <span className="text-300 font-medium">{String(value ?? '')}</span>
        ),
      },
      { id: 'itemType', header: 'Type', sortable: true, filterable: true },
      {
        id: 'workspaceName',
        header: 'Workspace',
        sortable: true,
        filterable: true,
        minWidth: 180,
      },
      {
        id: 'scheduleCount',
        header: 'Schedules',
        sortable: true,
        numericStyling: true,
        width: 110,
      },
      {
        id: 'disabledCount',
        header: 'Disabled',
        sortable: true,
        numericStyling: true,
        width: 110,
        cellRenderer: (value) => {
          const count = typeof value === 'number' ? value : 0;
          return (
            <span
              className={cn(
                'text-200 inline-flex items-center gap-200 rounded-full px-300 py-100 font-medium tabular-nums',
                count > 0
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {formatNumber(count)}
            </span>
          );
        },
      },
      {
        id: 'lastSynced',
        header: 'Last synced',
        width: 170,
        cellRenderer: (value) => (
          <span className="text-200 text-muted-foreground">{String(value ?? '')}</span>
        ),
      },
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
        disabledCount: (
          schedulesByArtifact.get(artifact.id) ?? []
        ).filter((schedule) => !schedule.enabled).length,
        lastSynced: formatTimestamp(artifact.lastSyncedAt),
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

  const hasFilters = workspaceFilter !== '' || typeFilter !== '' || schedulesOnly;
  const totals = computeTotals(artifacts, schedulesByArtifact);

  return (
    <main className="px-500 py-500">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-500">
        <header className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-400 p-500">
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
          </div>
          <div className="border-border flex flex-wrap items-end gap-400 border-t px-500 py-400">
            <FilterSelect
              id="workspace-filter"
              label="Workspace"
              value={workspaceFilter}
              onChange={setWorkspaceFilter}
              options={workspaceOptions}
            />
            <FilterSelect
              id="type-filter"
              label="Item type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={typeOptions}
            />
            <label className="text-300 flex items-center gap-200 pb-200">
              <input
                type="checkbox"
                className="accent-primary"
                checked={schedulesOnly}
                onChange={(event) => setSchedulesOnly(event.target.checked)}
              />
              Only artifacts with schedules
            </label>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setWorkspaceFilter('');
                  setTypeFilter('');
                  setSchedulesOnly(false);
                }}
                className="text-primary text-300 focus-visible:ring-ring pb-200 font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                Reset
              </button>
            ) : null}
            <p className="text-200 ml-auto pb-200 tabular-nums text-muted-foreground">
              Showing {formatNumber(visibleArtifacts.length)} of{' '}
              {formatNumber(artifacts.length)} artifacts
            </p>
          </div>
        </header>

        <InventorySummary totals={totals} lastRun={lastRun} />

        <div className="grid items-start gap-400 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {visibleArtifacts.length === 0 ? (
          hasFilters ? (
            <EmptyState
              title="No artifacts match the current filters"
              hint="Clear the workspace or type filter to see everything."
            />
          ) : (
            <EmptyState
              title="No schedulable artifacts on file"
              hint="Run a sync from the home page to populate the inventory."
            />
          )
        ) : (
          <div
            className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm"
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
            className="border-border bg-card rounded-2xl border p-500 shadow-sm"
            aria-label="Schedule detail"
          >
            <p className="text-100 text-primary font-semibold uppercase tracking-widest">
              Schedule detail
            </p>
            <h2 className="font-heading text-500 mt-100 font-semibold">
              {safeText(selected.displayName)}
            </h2>
            <p className="text-200 text-muted-foreground mb-400">
              {safeText(selected.workspaceName)} ·{' '}
              {safeText(selected.itemType)} · job types probed:{' '}
              {safeText(selected.jobTypesProbed)}
            </p>
            {selectedSchedules.length === 0 ? (
              <p className="text-300 text-muted-foreground">
                No schedules found for this artifact.
              </p>
            ) : (
              <ScheduleDetail schedules={selectedSchedules} />
            )}
          </section>
        ) : (
          <p className="text-200 border-border bg-card rounded-2xl border border-dashed px-500 py-600 text-center text-muted-foreground">
            Select a row to see its schedule details.
          </p>
        )}
        </div>
      </div>
    </main>
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
  options: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-100">
      <label htmlFor={id} className="text-200 text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={CONTROL_CLASS}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {safeText(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Rows may predate optional fields; never interpolate raw values. */
function safeText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '—';
}
