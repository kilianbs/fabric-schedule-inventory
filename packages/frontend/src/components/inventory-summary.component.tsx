//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactNode } from 'react';
import { Boxes, CalendarClock, CirclePause, FolderTree } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { SyncRunRecord } from '@rayfin-app/shared';

import type { InventoryTotals } from '@/lib/inventory-totals';
import { cn, formatNumber } from '@/lib/utils';

interface TileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  /** Danger tone for figures that need attention (e.g. disabled schedules). */
  alert?: boolean;
  /** Optional visual under the hint, e.g. a meter. */
  children?: ReactNode;
  /** Position in the row; staggers the entrance animation. */
  index?: number;
}

/**
 * A compact KPI tile: the icon chip anchors the figure on the left, label,
 * value and hint stack on the right so values line up across the row.
 */
function Tile({
  icon: Icon,
  label,
  value,
  hint,
  alert,
  children,
  index = 0,
}: TileProps) {
  return (
    <li
      className="border-border bg-card animate-fade-up flex min-w-0 items-start gap-300 rounded-2xl border p-400 shadow-sm transition-[translate,box-shadow,border-color] duration-200 hover:-translate-y-100-nudge hover:border-primary/40 hover:shadow-md"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div
        className={cn(
          'inline-flex h-700 w-700 shrink-0 items-center justify-center rounded-xl',
          alert
            ? 'bg-destructive/10 text-destructive'
            : 'bg-primary/10 text-primary'
        )}
      >
        <Icon aria-hidden="true" className="icon-size-300" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-100">
        <p className="text-200 font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            'font-numeric text-hero-700 leading-hero-700 font-semibold tabular-nums',
            alert && 'text-destructive'
          )}
        >
          {value}
        </p>
        <p className="text-200 truncate text-muted-foreground">{hint}</p>
        {children}
      </div>
    </li>
  );
}

/** Stacked enabled/disabled bar; disabled share uses the danger tone. */
function EnabledMeter({
  enabled,
  disabled,
}: {
  enabled: number;
  disabled: number;
}) {
  const total = enabled + disabled;
  if (total === 0) return null;
  const enabledShare = (enabled / total) * 100;
  return (
    <div
      role="img"
      aria-label={`${formatNumber(enabled)} enabled, ${formatNumber(disabled)} disabled`}
      className="bg-muted mt-100 flex h-100 w-full overflow-hidden rounded-full"
    >
      <span className="animate-grow-x flex h-full w-full origin-left [animation-delay:240ms]">
        <span className="bg-primary h-full" style={{ width: `${enabledShare}%` }} />
        <span className="bg-destructive h-full flex-1" />
      </span>
    </div>
  );
}

export interface InventorySummaryProps {
  totals: InventoryTotals;
  lastRun: SyncRunRecord | null;
}

/** Global figures for the whole inventory, as a row of KPI tiles. */
export function InventorySummary({ totals, lastRun }: InventorySummaryProps) {
  const scanned = lastRun?.workspacesScanned;
  const disabledShare =
    totals.schedules === 0 ? 0 : (totals.disabled / totals.schedules) * 100;

  return (
    <section aria-label="Inventory summary">
      <ul className="grid gap-400 sm:grid-cols-2 xl:grid-cols-4">
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
          index={1}
          value={formatNumber(totals.artifacts)}
          hint="schedulable items"
        />
        <Tile
          icon={CalendarClock}
          label="Schedules"
          index={2}
          value={formatNumber(totals.schedules)}
          hint={`${formatNumber(totals.enabled)} enabled`}
        >
          <EnabledMeter enabled={totals.enabled} disabled={totals.disabled} />
        </Tile>
        <Tile
          icon={CirclePause}
          label="Disabled"
          index={3}
          value={formatNumber(totals.disabled)}
          hint={
            totals.disabled === 0
              ? 'all schedules active'
              : `${formatPercent(disabledShare)} of schedules off`
          }
          alert={totals.disabled > 0}
        />
      </ul>
    </section>
  );
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value / 100);
}
