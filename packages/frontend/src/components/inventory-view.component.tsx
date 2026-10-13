//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ExternalLink,
  Folder,
  MousePointerClick,
  Search,
  Server,
  Shapes,
  X,
} from 'lucide-react';

import type {
  ArtifactRecord,
  ScheduleRecord,
  SyncRunRecord,
} from '@rayfin-app/shared';

import { ArtifactTable } from '@/components/artifact-table.component';
import type { ArtifactTableRow } from '@/components/artifact-table.component';
import { FilterMenu } from '@/components/filter-menu.component';
import { InventorySummary } from '@/components/inventory-summary.component';
import { ItemTypeIcon, TypeBadge } from '@/components/item-type.component';
import { ScheduleDetail } from '@/components/schedule-detail.component';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import {
  capacityOptions as toCapacityOptions,
  countBy,
  DEFAULT_FILTERS,
  filterArtifacts,
  isDefaultFilters,
} from '@/lib/filter-artifacts';
import type { ArtifactFilters } from '@/lib/filter-artifacts';
import { capacityInfo } from '@/lib/gantt';
import { fabricLinks } from '@/lib/fabric-links';
import { computeTotals } from '@/lib/inventory-totals';
import { cn, formatNumber } from '@/lib/utils';

export type InventoryStatus = 'loading' | 'error' | 'ready';

export interface InventoryViewProps {
  status: InventoryStatus;
  errorMessage?: string;
  artifacts: ArtifactRecord[];
  schedulesByArtifact: Map<string, ScheduleRecord[]>;
  lastRun?: SyncRunRecord | null;
  /** Fabric portal base URL from the deployment config (public cloud if unset). */
  portalUrl?: string;
  onRetry?: () => void;
}

const FOCUS =
  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';

const CONTROL_CLASS = cn(
  'border-input bg-background text-foreground text-300 h-800 rounded-lg border px-300',
  FOCUS
);

/** Detail sits beside the grid from Tailwind's `2xl` breakpoint (96rem). */
const SIDE_BY_SIDE_QUERY = '(min-width: 96rem)';

const SECONDARY_BUTTON = cn(
  'border-border bg-background hover:bg-accent text-300 inline-flex h-800 items-center gap-200 rounded-lg border px-300 font-medium transition-[color,background-color,border-color,scale] duration-150 active:scale-95',
  FOCUS
);

/**
 * The artifact schedule inventory: global figures, filters and a table of
 * every scheduled artifact, with the selected row's schedules beside it.
 */
export function InventoryView({
  status,
  errorMessage,
  artifacts,
  schedulesByArtifact,
  lastRun = null,
  portalUrl,
  onRetry,
}: InventoryViewProps) {
  const [filters, setFilters] = useState<ArtifactFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);

  const updateFilter = <K extends keyof ArtifactFilters>(
    key: K,
    value: ArtifactFilters[K]
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const capacityOptions = useMemo(
    () => toCapacityOptions(artifacts),
    [artifacts]
  );
  // Workspaces narrow to the selected capacity.
  const workspaceOptions = useMemo(
    () =>
      countBy(
        filterArtifacts(artifacts, {
          ...DEFAULT_FILTERS,
          capacity: filters.capacity,
        }),
        'workspaceName'
      ).map((option) => ({ ...option, label: option.value })),
    [artifacts, filters.capacity]
  );

  const updateCapacity = (capacity: string) =>
    setFilters((current) => {
      const workspaceStillListed =
        current.workspace === '' ||
        filterArtifacts(artifacts, { ...DEFAULT_FILTERS, capacity }).some(
          (artifact) => artifact.workspaceName === current.workspace
        );
      return {
        ...current,
        capacity,
        workspace: workspaceStillListed ? current.workspace : '',
      };
    });

  // Below 2xl the detail stacks under the grid; bring it into view on select.
  useEffect(() => {
    if (selectedId === null) return;
    if (window.matchMedia?.(SIDE_BY_SIDE_QUERY).matches) return;
    detailRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);
  const typeOptions = useMemo(
    () =>
      countBy(artifacts, 'itemType').map((option) => ({
        ...option,
        label: option.value,
        icon: <ItemTypeIcon itemType={option.value} />,
      })),
    [artifacts]
  );

  const visibleArtifacts = useMemo(
    () => filterArtifacts(artifacts, filters),
    [artifacts, filters]
  );

  const rows = useMemo<ArtifactTableRow[]>(
    () =>
      visibleArtifacts.map((artifact) => ({
        id: artifact.id,
        displayName: safeText(artifact.displayName),
        itemType: safeText(artifact.itemType),
        workspaceName: safeText(artifact.workspaceName),
        capacity: capacityInfo(artifact).label,
        scheduleCount: artifact.scheduleCount ?? 0,
        disabledCount: disabledCount(schedulesByArtifact.get(artifact.id)),
        lastSyncedAt: artifact.lastSyncedAt,
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
  const activeChips = [
    filters.query.trim() !== '' && {
      key: 'query',
      label: 'Search',
      value: `“${filters.query.trim()}”`,
      clear: () => updateFilter('query', ''),
    },
    filters.capacity !== '' && {
      key: 'capacity',
      label: 'Capacity',
      value:
        capacityOptions.find((option) => option.value === filters.capacity)
          ?.label ?? filters.capacity,
      clear: () => updateCapacity(''),
    },
    filters.workspace !== '' && {
      key: 'workspace',
      label: 'Workspace',
      value: filters.workspace,
      clear: () => updateFilter('workspace', ''),
    },
    filters.type !== '' && {
      key: 'type',
      label: 'Item type',
      value: filters.type,
      clear: () => updateFilter('type', ''),
    },
  ].filter((chip) => chip !== false);

  return (
    <main className="px-300 py-500 sm:px-500">
      <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-500">
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

        <div className="grid items-start gap-400 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section
            aria-labelledby="artifacts-heading"
            className="border-border bg-card animate-fade-up min-w-0 rounded-2xl border shadow-sm [animation-delay:240ms]"
          >
            <div className="flex flex-col gap-300 p-400">
              <div className="flex items-baseline justify-between gap-300">
                <h2
                  id="artifacts-heading"
                  className="font-heading text-400 font-semibold"
                >
                  Artifacts
                </h2>
                <p
                  className="text-200 tabular-nums text-muted-foreground"
                  aria-live="polite"
                >
                  <span className="font-semibold text-foreground">
                    {formatNumber(visibleArtifacts.length)}
                  </span>
                  &nbsp;of {formatNumber(artifacts.length)} artifacts
                </p>
              </div>

              <div
                role="search"
                aria-label="Filter artifacts"
                className="flex flex-wrap items-center gap-200"
              >
                <div className="relative min-w-0 flex-1 basis-56">
                  <label htmlFor="artifact-search" className="sr-only">
                    Search artifacts
                  </label>
                  <Search
                    aria-hidden="true"
                    className="icon-size-200 pointer-events-none absolute top-1/2 left-300 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    id="artifact-search"
                    type="search"
                    placeholder="Search artifacts…"
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
                <FilterMenu
                  label="Capacity"
                  allLabel="All capacities"
                  icon={Server}
                  value={filters.capacity}
                  onChange={updateCapacity}
                  options={capacityOptions}
                />
                <FilterMenu
                  label="Workspace"
                  allLabel="All workspaces"
                  icon={Folder}
                  value={filters.workspace}
                  onChange={(value) => updateFilter('workspace', value)}
                  options={workspaceOptions}
                />
                <FilterMenu
                  label="Item type"
                  allLabel="All item types"
                  icon={Shapes}
                  value={filters.type}
                  onChange={(value) => updateFilter('type', value)}
                  options={typeOptions}
                />
              </div>

              {filtersChanged ? (
                <div
                  aria-label="Active filters"
                  role="group"
                  className="animate-fade-in flex flex-wrap items-center gap-200"
                >
                  {activeChips.map((chip) => (
                    <span
                      key={chip.key}
                      className="border-primary/30 bg-primary/5 text-200 inline-flex max-w-full items-center gap-100 rounded-full border py-100-nudge pr-100 pl-300"
                    >
                      <span className="text-muted-foreground">{chip.label}</span>
                      <span className="truncate font-medium">{chip.value}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${chip.label.toLowerCase()} filter`}
                        onClick={chip.clear}
                        className={cn(
                          'hover:bg-primary/15 inline-flex h-500 w-500 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground',
                          FOCUS
                        )}
                      >
                        <X aria-hidden="true" className="icon-size-100" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={cn(
                      'text-200 rounded-md px-200 py-100 font-medium text-muted-foreground hover:text-foreground hover:underline underline-offset-2',
                      FOCUS
                    )}
                  >
                    Clear all
                  </button>
                </div>
              ) : null}
            </div>

            <div className="border-border border-t">
              {visibleArtifacts.length === 0 ? (
                <div className="p-400">
                  {filtersChanged ? (
                    <EmptyState
                      title="No artifacts match the current filters"
                      hint="Adjust the search or filters to see more artifacts."
                      action={
                        <button
                          type="button"
                          onClick={clearFilters}
                          className={SECONDARY_BUTTON}
                        >
                          <X aria-hidden="true" className="icon-size-200" />
                          Show all artifacts
                        </button>
                      }
                    />
                  ) : (
                    <EmptyState
                      title="No scheduled artifacts on file"
                      hint="Run a sync to populate the inventory."
                    />
                  )}
                </div>
              ) : (
                <ArtifactTable
                  rows={rows}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )}
            </div>
          </section>

          {selected ? (
            <section
              key={selected.id}
              ref={detailRef}
              className="border-border bg-card animate-slide-in scroll-mt-400 rounded-2xl border p-500 shadow-sm 2xl:sticky 2xl:top-400"
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
              <PortalLinks artifact={selected} portalUrl={portalUrl} />
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
            <div className="border-border bg-card animate-fade-in flex items-center gap-300 rounded-2xl border border-dashed px-400 py-300 2xl:sticky 2xl:top-400 2xl:flex-col 2xl:gap-200 2xl:px-500 2xl:py-800 2xl:text-center">
              <MousePointerClick
                aria-hidden="true"
                className="icon-size-300 2xl:icon-size-400 shrink-0 animate-bounce text-muted-foreground [animation-iteration-count:3]"
              />
              <div className="flex flex-col gap-100">
                <p className="text-300 font-medium">No artifact selected</p>
                <p className="text-200 text-muted-foreground">
                  Select a row to see its schedules.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/** "Open in Fabric" (when the item's page URL is known) and "Open workspace". */
function PortalLinks({
  artifact,
  portalUrl,
}: {
  artifact: ArtifactRecord;
  portalUrl: string | undefined;
}) {
  const links = fabricLinks(artifact, portalUrl);
  if (!links.workspace) return null;
  const name = safeText(artifact.displayName);
  return (
    <div className="mt-300 flex flex-wrap items-center gap-200">
      {links.item ? (
        <a
          href={links.item}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${name} in Fabric (new tab)`}
          className={cn(
            'bg-primary text-primary-foreground hover:bg-primary/90 text-300 inline-flex h-800 items-center gap-200 rounded-lg px-300 font-medium transition-colors duration-150',
            FOCUS
          )}
        >
          <ExternalLink aria-hidden="true" className="icon-size-200" />
          Open in Fabric
        </a>
      ) : null}
      <a
        href={links.workspace}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open workspace ${safeText(artifact.workspaceName)} in Fabric (new tab)`}
        className={SECONDARY_BUTTON}
      >
        <Folder aria-hidden="true" className="icon-size-200" />
        Open workspace
      </a>
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
