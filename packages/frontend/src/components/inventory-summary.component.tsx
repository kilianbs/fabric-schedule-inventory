//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
  Boxes,
  CalendarClock,
  CirclePause,
  FolderTree,
  History,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { SyncRunRecord } from '@rayfin-app/shared';

import type { InventoryTotals } from '@/lib/inventory-totals';
import { cn, formatNumber, formatTimestamp } from '@/lib/utils';

interface TileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  /** Danger tone for figures that need attention (e.g. disabled schedules). */
  alert?: boolean;
}

/**
 * Every tile has the same three rows so values line up across the grid.
 * The icon sits in a tinted chip so figures have a clear visual anchor.
 */
function Tile({ icon: Icon, label, value, hint, alert }: TileProps) {
  return (
    <li className="border-border bg-background flex min-w-0 flex-col gap-300 rounded-xl border p-400 transition-colors hover:border-primary/40">
      <div
        className={cn(
          'inline-flex h-600 w-600 shrink-0 items-center justify-center rounded-lg',
          alert ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
        )}
      >
        <Icon aria-hidden="true" className="h-300 w-300" />
      </div>
      <div className="flex flex-col gap-100">
        <p className="text-200 font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            'font-numeric text-hero-700 font-semibold tabular-nums',
            alert && 'text-destructive'
          )}
        >
          {value}
        </p>
        <p className="text-200 text-muted-foreground">{hint}</p>
      </div>
    </li>
  );
}

export interface InventorySummaryProps {
  totals: InventoryTotals;
  lastRun: SyncRunRecord | null;
}

/** Global figures for the whole inventory, in one card of equal-size tiles. */
export function InventorySummary({ totals, lastRun }: InventorySummaryProps) {
  const lastSync = lastRun
    ? formatTimestamp(lastRun.finishedAt ?? lastRun.startedAt)
    : 'No sync yet';
  const scanned = lastRun?.workspacesScanned;

  return (
    <section aria-label="Inventory summary">
      <p className="text-100 font-semibold uppercase tracking-widest text-muted-foreground">
        Global figures
      </p>
      <h2 className="font-heading text-500 mt-100 font-semibold">
        {formatNumber(totals.schedules)} schedule{totals.schedules === 1 ? '' : 's'}{' '}
        across {formatNumber(totals.artifacts)} artifact
        {totals.artifacts === 1 ? '' : 's'}
      </h2>
      <ul className="border-border bg-card mt-300 grid auto-rows-fr gap-400 rounded-2xl border p-400 shadow-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Tile
          icon={FolderTree}
          label="Workspaces"
          value={formatNumber(totals.workspaces)}
          hint={
            scanned === undefined
              ? 'with schedulable artifacts'
              : `${formatNumber(scanned)} scanned in last sync`
          }
        />
        <Tile
          icon={Boxes}
          label="Artifacts"
          value={formatNumber(totals.artifacts)}
          hint="schedulable items"
        />
        <Tile
          icon={CalendarClock}
          label="Schedules"
          value={formatNumber(totals.schedules)}
          hint={`${formatNumber(totals.enabled)} enabled`}
        />
        <Tile
          icon={CirclePause}
          label="Disabled"
          value={formatNumber(totals.disabled)}
          hint={
            totals.disabled === 0
              ? 'all schedules active'
              : `${formatNumber(totals.disabled)} of ${formatNumber(totals.schedules)} schedules off`
          }
          alert={totals.disabled > 0}
        />
        <Tile
          icon={History}
          label="Last sync"
          value={lastRun ? statusLabel(lastRun.status) : '—'}
          hint={lastSync}
        />
      </ul>
    </section>
  );
}

function statusLabel(value: string): string {
  return value.length === 0 ? '—' : value[0].toUpperCase() + value.slice(1);
}
