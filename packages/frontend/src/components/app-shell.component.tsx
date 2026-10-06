//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ReactNode } from 'react';
import { Info, LayoutDashboard, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { SyncRunRecord } from '@rayfin-app/shared';

import { FabricAppMark } from '@/FabricAppMark';
import type { AppRoute } from '@/hooks/use-hash-route';
import { cn, formatNumber, formatTimestamp } from '@/lib/utils';

interface NavItem {
  route: AppRoute;
  label: string;
  icon: LucideIcon;
}

const NAV_SECTIONS: readonly { title: string; items: readonly NavItem[] }[] = [
  {
    title: 'Explore',
    items: [{ route: 'inventory', label: 'Inventory', icon: LayoutDashboard }],
  },
  {
    title: 'System',
    items: [{ route: 'about', label: 'About', icon: Info }],
  },
];

const PAGE_TITLES: Record<AppRoute, string> = {
  inventory: 'Inventory',
  about: 'About',
};

export interface AppShellProps {
  route: AppRoute;
  onNavigate: (route: AppRoute) => void;
  lastRun: SyncRunRecord | null;
  artifactCount: number;
  isSyncing: boolean;
  onSync: () => void;
  children: ReactNode;
}

const ACTION_FOCUS =
  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';

/** Left navigation, a top bar with the page actions, and the page content. */
export function AppShell({
  route,
  onNavigate,
  lastRun,
  artifactCount,
  isSyncing,
  onSync,
  children,
}: AppShellProps) {
  const lastSync = lastRun
    ? formatTimestamp(lastRun.finishedAt ?? lastRun.startedAt)
    : null;
  const runTone = syncTone(lastRun?.status);

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="border-border bg-card flex flex-col gap-400 border-b px-300 py-300 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0 lg:py-400">
        <div className="flex items-center gap-300 px-200">
          <div className="h-700 w-700 shrink-0">
            <FabricAppMark />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-400 font-semibold leading-none">
              Schedule Inventory
            </p>
            <p className="text-200 mt-100 text-muted-foreground">
              Fabric workspaces
            </p>
          </div>
        </div>

        <nav
          aria-label="Main"
          className="flex flex-wrap gap-x-400 gap-y-300 lg:flex-col"
        >
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-100">
              <p className="text-100 px-300 pb-100 font-semibold uppercase tracking-widest text-muted-foreground">
                {section.title}
              </p>
              {section.items.map(({ route: target, label, icon: Icon }) => {
                const active = target === route;
                return (
                  <a
                    key={target}
                    href={target === 'about' ? '#/about' : '#/'}
                    aria-current={active ? 'page' : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate(target);
                    }}
                    className={cn(
                      'text-300 inline-flex items-center gap-200 rounded-lg border-l-4 px-300 py-200 font-medium transition-[color,background-color,border-color,translate] duration-200 hover:translate-x-100-nudge',
                      ACTION_FOCUS,
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-accent border-transparent'
                    )}
                  >
                    <Icon aria-hidden="true" className="icon-size-200" />
                    {label}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-border bg-background hidden rounded-xl border p-300 lg:mt-auto lg:block">
          <p className="text-100 font-semibold uppercase tracking-widest text-muted-foreground">
            Fabric scope
          </p>
          <p className="text-300 mt-100 font-semibold">
            All accessible workspaces
          </p>
          <p className="text-200 mt-100 flex items-center gap-200 text-muted-foreground">
            <span
              aria-hidden="true"
              className="bg-primary h-100 w-100 rounded-full"
            />
            {formatNumber(artifactCount)} schedulable artifact
            {artifactCount === 1 ? '' : 's'}
          </p>
          <p className="text-200 mt-100 flex items-center gap-200 text-muted-foreground">
            <span
              aria-hidden="true"
              className={cn('h-100 w-100 shrink-0 rounded-full', runTone.dot)}
            />
            <span>
              {lastSync ? (
                <>
                  <span className={cn('font-medium', runTone.text)}>
                    {runTone.label}
                  </span>{' '}
                  · {lastSync}
                </>
              ) : (
                'Not synced yet'
              )}
            </span>
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-border bg-card flex flex-wrap items-center justify-between gap-300 border-b px-500 py-300">
          <p className="text-300 text-muted-foreground">
            Fabric · Schedule Inventory ·{' '}
            <span className="font-medium text-foreground">
              {PAGE_TITLES[route]}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-200">
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              className={cn(
                'bg-primary text-primary-foreground hover:bg-primary/90 text-300 inline-flex items-center gap-200 rounded-lg px-400 py-200 font-medium transition-[background-color,scale,box-shadow] duration-150 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
                ACTION_FOCUS
              )}
            >
              <RefreshCw
                aria-hidden="true"
                className={cn('icon-size-200', isSyncing && 'animate-spin')}
              />
              {isSyncing ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        </div>
        <div key={route} className="bg-accent animate-fade-in min-w-0 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Label and colour for the latest sync run's status. */
function syncTone(status: string | undefined): {
  label: string;
  dot: string;
  text: string;
} {
  switch (status) {
    case 'failed':
      return { label: 'Failed', dot: 'bg-destructive', text: 'text-destructive' };
    case 'running':
      return {
        label: 'Running',
        dot: 'bg-primary animate-pulse',
        text: 'text-primary',
      };
    case 'completed':
      return { label: 'Synced', dot: 'bg-primary', text: 'text-foreground' };
    default:
      return {
        label: status && status.length > 0 ? status : 'Unknown',
        dot: 'bg-muted-foreground',
        text: 'text-foreground',
      };
  }
}
