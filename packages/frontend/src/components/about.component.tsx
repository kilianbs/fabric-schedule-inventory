//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { Boxes, CalendarClock, FolderTree, ShieldCheck } from 'lucide-react';

import type { SyncRunRecord } from '@rayfin-app/shared';

import { formatTimestamp } from '@/lib/utils';

const SCOPE = [
  {
    icon: FolderTree,
    title: 'Workspaces',
    text: 'Every workspace the app identity can reach.',
  },
  {
    icon: Boxes,
    title: 'Artifacts',
    text: 'Notebooks, pipelines, dataflows and copy jobs that support schedules.',
  },
  {
    icon: CalendarClock,
    title: 'Schedules',
    text: 'Cadence, time zone, owner and enabled state of each schedule.',
  },
] as const;

/** Explains what the app collects, under which identity, and what the last sync did. */
export function About({ lastRun }: { lastRun: SyncRunRecord | null }) {
  return (
    <main className="px-500 py-500">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-500">
        <header>
          <p className="text-100 text-primary font-semibold uppercase tracking-widest">
            About
          </p>
          <h1 className="font-heading text-hero-800 mt-100 font-semibold tracking-tight">
            Fabric Schedule Inventory
          </h1>
          <p className="text-400 mt-200 max-w-2xl leading-500 text-muted-foreground">
            One synchronization scans the workspaces the app identity can access,
            finds the artifacts that support schedules and keeps their schedule
            metadata on file, so you can see what runs, and when.
          </p>
        </header>

        <section aria-label="What is scanned">
          <ul className="grid gap-300 md:grid-cols-3">
            {SCOPE.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="border-border bg-card flex items-start gap-300 rounded-xl border p-400 shadow-sm"
              >
                <span className="bg-primary/10 text-primary inline-flex h-600 w-600 shrink-0 items-center justify-center rounded-lg">
                  <Icon aria-hidden="true" className="h-300 w-300" />
                </span>
                <span>
                  <span className="text-300 block font-semibold">{title}</span>
                  <span className="text-200 text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-400 lg:grid-cols-2">
          <section
            aria-label="Identity and privacy"
            className="border-border bg-card rounded-2xl border p-500 shadow-sm"
          >
            <p className="text-100 text-primary font-semibold uppercase tracking-widest">
              Identity &amp; privacy
            </p>
            <p className="text-300 mt-200 leading-400 text-muted-foreground">
              The scan runs under the app identity. Only workspaces that identity
              can access are included, so the inventory reflects its permissions
              rather than yours.
            </p>
            <p className="text-200 mt-300 flex items-start gap-200 text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="h-300 w-300 shrink-0" />
              Only schedule metadata is stored. Business data never leaves Fabric.
            </p>
          </section>

          <section
            aria-label="Last run log"
            className="border-border bg-card rounded-2xl border p-500 shadow-sm"
          >
            <p className="text-100 text-primary font-semibold uppercase tracking-widest">
              Last run log
            </p>
            {lastRun ? <RunLog run={lastRun} /> : (
              <p className="text-300 mt-200 text-muted-foreground">
                No synchronization has run yet.
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function RunLog({ run }: { run: SyncRunRecord }) {
  const rows: [string, string][] = [
    ['Status', run.status],
    ['Started', formatTimestamp(run.startedAt)],
    ['Finished', formatTimestamp(run.finishedAt)],
    ['Triggered by', run.triggeredBy],
    [
      'Workspaces',
      `${run.workspacesScanned} scanned, ${run.workspacesFailed} failed`,
    ],
    ['Artifacts found', String(run.artifactsFound)],
    ['Schedules found', String(run.schedulesFound)],
    ['Errors', String(run.errorCount)],
  ];
  return (
    <>
      <dl className="text-300 mt-300 grid grid-cols-[auto_1fr] gap-x-400 gap-y-200">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="break-words font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {run.errorSummary ? (
        <p
          role="status"
          className="bg-destructive/10 text-destructive text-200 mt-300 rounded-lg px-300 py-200 break-words"
        >
          {run.errorSummary}
        </p>
      ) : null}
    </>
  );
}
