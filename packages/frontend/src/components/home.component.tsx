//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
  Boxes,
  CalendarClock,
  FolderTree,
  History,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import type { SyncRunRecord } from '@rayfin-app/shared';

import { FabricAppMark } from '@/FabricAppMark';
import {
  ProgressRing,
  StepBadge,
} from '@/components/sync-progress.component';
import type { SyncPhase } from '@/hooks/use-sync';
import { SYNC_STEPS, stepIndexFor, stepState } from '@/lib/sync-steps';

export interface HomeProps {
  /** Rendered after a sync has produced (or confirmed) zero artifacts. */
  lastRun?: SyncRunRecord | null;
  phase: SyncPhase;
  onSync: () => void;
}

const FEATURES = [
  {
    icon: FolderTree,
    title: 'Workspaces',
    text: 'Every workspace the app identity can reach',
  },
  {
    icon: Boxes,
    title: 'Artifacts',
    text: 'Notebooks, pipelines, dataflows, copy jobs',
  },
  {
    icon: CalendarClock,
    title: 'Schedules',
    text: 'Cadence, time zone, owner and enabled state',
  },
  {
    icon: History,
    title: 'Run log',
    text: 'What each sync found and when it ran',
  },
] as const;

/**
 * The landing view when the inventory is empty: explains what the app does,
 * offers the sync button, and shows live progress while metadata is fetched.
 * Also used after a sync that found no scheduled artifacts.
 */
export function Home({ lastRun, phase, onSync }: HomeProps) {
  const isRunning = phase.kind === 'running';
  const isFailed = phase.kind === 'failed';
  const finished = phase.kind === 'completed';
  const progress = phase.kind === 'running' ? phase.progress : undefined;
  const completedEmpty =
    phase.kind === 'completed' &&
    phase.summary.artifactsFound === 0 &&
    phase.summary.workspacesScanned > 0;

  const failedRun = phase.kind === 'failed' ? phase.summary : undefined;
  const shown = progress ?? failedRun;
  const percent = finished ? 100 : (shown?.progressPercent ?? 0);
  const current = stepIndexFor(shown?.stage, finished);
  const started = isRunning || finished || (isFailed && shown !== undefined);
  const activeStep = SYNC_STEPS[Math.min(current, SYNC_STEPS.length - 1)];

  const total = shown?.workspacesTotal ?? 0;
  const processed = shown?.workspacesProcessed ?? 0;

  const heading = isRunning
    ? `${activeStep.label} — ${activeStep.detail.toLowerCase()}`
    : finished
      ? 'Sync complete'
      : isFailed
        ? 'Sync interrupted'
        : 'Ready to build the inventory';
  const caption = isRunning
    ? 'In progress'
    : finished
      ? 'Complete'
      : isFailed
        ? 'Stopped'
        : 'Ready';

  const status = isRunning
    ? { label: 'Syncing', tone: 'bg-primary/10 text-primary' }
    : isFailed
      ? { label: 'Last sync failed', tone: 'bg-destructive/10 text-destructive' }
      : { label: 'Sync services ready', tone: 'bg-primary/10 text-primary' };

  return (
    <div className="flex flex-1 flex-col justify-center px-400 py-600">
      <div className="border-border bg-card mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl border shadow-sm">
        <header className="border-border flex flex-wrap items-center justify-between gap-300 border-b px-600 py-400">
          <div className="flex items-center gap-300">
            <div className="h-700 w-700 shrink-0">
              <FabricAppMark />
            </div>
            <div>
              <p className="font-heading text-400 font-semibold leading-none">
                Fabric Schedule Inventory
              </p>
              <p className="text-200 mt-100 text-muted-foreground">
                Schedule metadata · Fabric workspaces
              </p>
            </div>
          </div>
          <span
            className={`text-200 inline-flex items-center gap-200 rounded-full px-300 py-100 font-medium ${status.tone}`}
          >
            <span aria-hidden="true" className="h-100 w-100 rounded-full bg-current" />
            {status.label}
          </span>
        </header>

        <main className="grid gap-600 p-600 lg:grid-cols-[1.15fr_1fr]">
          <section className="flex flex-col">
            <span className="text-200 bg-primary/10 text-primary inline-flex w-fit items-center gap-200 rounded-full px-300 py-100 font-medium">
              <Sparkles aria-hidden="true" className="h-300 w-300" />
              {lastRun && lastRun.status === 'completed'
                ? 'Inventory is empty'
                : 'No inventory yet'}
            </span>
            <h1 className="font-heading text-hero-900 mt-400 font-semibold leading-tight tracking-tight">
              Fabric Schedule Inventory
            </h1>
            <p className="font-heading text-hero-700 text-primary font-semibold leading-tight tracking-tight">
              Know what runs, and when.
            </p>
            <p className="text-400 mt-300 max-w-xl leading-500 text-muted-foreground">
              One synchronization scans every workspace the app identity can
              access and keeps only the artifacts that have a schedule, with their
              schedule metadata and recent job runs. Business data never leaves
              Fabric.
            </p>

            {lastRun && lastRun.status === 'completed' ? (
              <div className="mt-400 flex flex-wrap gap-200">
                {(
                  [
                    [lastRun.workspacesScanned, 'workspace'],
                    [lastRun.artifactsFound, 'artifact'],
                    [lastRun.schedulesFound, 'schedule'],
                  ] as const
                ).map(([count, noun]) => (
                  <span
                    key={noun}
                    className="border-border bg-background text-200 rounded-full border px-300 py-100 font-medium"
                  >
                    {count} {noun}
                    {count === 1 ? '' : 's'}
                  </span>
                ))}
                <span className="text-200 self-center text-muted-foreground">
                  Last sync {formatTimestamp(lastRun.finishedAt ?? lastRun.startedAt)}
                </span>
              </div>
            ) : null}

            {completedEmpty ? (
              <p
                className="border-border bg-background text-300 mt-400 rounded-lg border px-400 py-300 leading-300 text-muted-foreground"
                role="status"
              >
                Sync finished: {phase.summary.workspacesScanned} workspace
                {phase.summary.workspacesScanned === 1 ? '' : 's'} scanned, no
                scheduled artifacts found. Inventories can look empty when the
                app identity's workspaces contain none of the supported item
                types.
              </p>
            ) : null}
          </section>

            <div className="border-border bg-background rounded-xl border p-500">
              <div className="flex items-start justify-between gap-300">
                <div>
                  <p className="text-100 text-primary font-semibold uppercase tracking-widest">
                    Synchronization progress
                  </p>
                  <p className="text-400 mt-100 font-medium" role="status" aria-live="polite">
                    {heading}
                  </p>
                </div>
                <span className="text-200 text-muted-foreground">
                  {isRunning ? 'live' : 'waiting'}
                </span>
              </div>

              <div className="my-500">
                <ProgressRing percent={percent} caption={caption} />
              </div>

              <ol className="grid grid-cols-5 gap-100">
                {SYNC_STEPS.map((step, index) => {
                  const state = stepState(index, current, started);
                  return (
                    <li
                      key={step.id}
                      aria-current={state === 'active' ? 'step' : undefined}
                      className="flex flex-col items-center gap-100 text-center"
                    >
                      <StepBadge index={index} state={state} />
                      <span
                        className={`text-100 ${state === 'pending' ? 'text-muted-foreground' : 'font-medium'}`}
                      >
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            <ul className="grid gap-300 sm:grid-cols-2 lg:auto-rows-fr">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li
                  key={title}
                  className="border-border bg-background flex items-start gap-300 rounded-xl border p-300"
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

            <div className="flex flex-col gap-400">
            <div className="border-border bg-card rounded-xl border p-500 shadow-sm">
              <p className="text-100 text-primary font-semibold uppercase tracking-widest">
                Scope
              </p>
              <p className="font-heading text-600 mt-100 font-semibold">
                All accessible workspaces
              </p>
              <div className="text-200 mt-300 flex justify-between text-muted-foreground">
                <span>
                  {isRunning && total > 0
                    ? `${processed} of ${total} workspaces scanned`
                    : 'Ready to build this inventory'}
                </span>
                <span>one full pass</span>
              </div>
              <div className="bg-muted mt-200 h-200 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <button
                type="button"
                onClick={onSync}
                disabled={isRunning}
                className="bg-primary text-primary-foreground hover:bg-primary/90 mt-400 inline-flex w-full items-center justify-center gap-200 rounded-lg px-500 py-300 text-400 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={`h-300 w-300 ${isRunning ? 'animate-spin' : ''}`}
                />
                {isRunning ? 'Syncing…' : 'Sync schedules now'}
              </button>
            </div>

            <p className="text-200 flex items-start gap-200 text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="h-300 w-300 shrink-0" />
              The scan runs under the app identity. Only workspaces that
              identity can access are included.
            </p>
            </div>
        </main>

        <footer className="border-border bg-background border-t px-600 py-300">
          <ol className="text-200 flex flex-wrap items-center justify-between gap-300 text-muted-foreground">
            {SYNC_STEPS.map((step, index) => (
              <li key={step.id} className="flex items-center gap-200">
                <StepBadge index={index} state={stepState(index, current, started)} />
                {step.label}
              </li>
            ))}
          </ol>
        </footer>
      </div>
    </div>
  );
}

function formatTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
