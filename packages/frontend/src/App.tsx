//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';

import type {
  ArtifactRecord,
  JobRunRecord,
  ScheduleRecord,
  SyncRunRecord,
} from '@rayfin-app/shared';

import { About } from '@/components/about.component';
import { AppShell } from '@/components/app-shell.component';
import { GanttView } from '@/components/gantt-view.component';
import { Home } from '@/components/home.component';
import { InventoryView } from '@/components/inventory-view.component';
import { ErrorState } from '@/components/states';
import { useHashRoute } from '@/hooks/use-hash-route';
import { useSync } from '@/hooks/use-sync';
import { getRayfinClient } from '@/lib/rayfin-client';

const ARTIFACT_FIELDS = [
  'id',
  'workspaceId',
  'workspaceName',
  'workspaceType',
  'itemId',
  'itemType',
  'displayName',
  'folderId',
  'description',
  'jobTypesProbed',
  'scheduleCount',
  'present',
  'firstSeenAt',
  'lastSyncedAt',
] as const;

const SCHEDULE_FIELDS = [
  'id',
  'scheduleFabricId',
  'workspaceId',
  'itemId',
  'artifactRowId',
  'jobType',
  'enabled',
  'configType',
  'startDateTime',
  'endDateTime',
  'localTimeZoneId',
  'intervalMinutes',
  'timesJson',
  'weekdaysJson',
  'monthlyConfigJson',
  'ownerId',
  'ownerType',
  'createdDateTime',
] as const;

const RUN_FIELDS = [
  'id',
  'status',
  'startedAt',
  'finishedAt',
  'triggeredBy',
  'workspacesScanned',
  'workspacesFailed',
  'artifactsFound',
  'schedulesFound',
  'errorCount',
  'stage',
  'progressPercent',
  'workspacesTotal',
  'workspacesProcessed',
  'errorSummary',
] as const;

const JOB_RUN_FIELDS = [
  'id',
  'artifactRowId',
  'jobType',
  'status',
  'startTimeUtc',
  'endTimeUtc',
  'durationSeconds',
] as const;

type JobRunsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; runs: JobRunRecord[] };

type InventoryState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      artifacts: ArtifactRecord[];
      schedules: Map<string, ScheduleRecord[]>;
    };

/**
 * The app shell: the home (empty) view with the sync button, or the
 * inventory grid once metadata exists. Schedules are joined to artifacts
 * client-side for the detail panel.
 */
function App() {
  const [inventory, setInventory] = useState<InventoryState>({
    kind: 'loading',
  });
  const [lastRun, setLastRun] = useState<SyncRunRecord | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [route, navigate] = useHashRoute();
  const [jobRuns, setJobRuns] = useState<JobRunsState>({ kind: 'loading' });
  const needsJobRuns = route === 'gantt';

  // Job runs are only needed by the Gantt page, so they load lazily (on first
  // visit and after each sync) instead of slowing the inventory view.
  useEffect(() => {
    if (!needsJobRuns) return;
    let cancelled = false;
    (async () => {
      try {
        const client = await getRayfinClient();
        const runs = await pageAllJobRuns(client);
        if (!cancelled) setJobRuns({ kind: 'ready', runs });
      } catch (error) {
        if (cancelled) return;
        setJobRuns({
          kind: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Job run history could not be loaded.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsJobRuns, reloadToken]);

  const loadInventory = useCallback(async () => {
    try {
      const client = await getRayfinClient();
      const artifacts = await pageAllArtifacts(client);
      const byId = new Map(artifacts.map((a) => [a.id, a]));

      const schedulesByArtifact = new Map<string, ScheduleRecord[]>();
      if (artifacts.length > 0) {
        const schedules = await pageAllSchedules(client);
        for (const schedule of schedules) {
          // Only keep rows that still join to a present artifact.
          if (!byId.has(schedule.artifactRowId)) continue;
          const bucket = schedulesByArtifact.get(schedule.artifactRowId);
          if (bucket) bucket.push(schedule);
          else schedulesByArtifact.set(schedule.artifactRowId, [schedule]);
        }
      }

      const runs = await client.data.SyncRun.select([...RUN_FIELDS])
        .orderBy({ startedAt: 'desc' })
        .first(1)
        .execute();
      setLastRun(runs[0] ?? null);

      setInventory({ kind: 'ready', artifacts, schedules: schedulesByArtifact });
    } catch (error) {
      setInventory({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'The inventory could not be loaded.',
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = await getRayfinClient();
        const artifacts = await pageAllArtifacts(client);
        const byId = new Map(artifacts.map((a) => [a.id, a]));

        const schedulesByArtifact = new Map<string, ScheduleRecord[]>();
        if (artifacts.length > 0) {
          const schedules = await pageAllSchedules(client);
          for (const schedule of schedules) {
            // Only keep rows that still join to a present artifact.
            if (!byId.has(schedule.artifactRowId)) continue;
            const bucket = schedulesByArtifact.get(schedule.artifactRowId);
            if (bucket) bucket.push(schedule);
            else schedulesByArtifact.set(schedule.artifactRowId, [schedule]);
          }
        }

        const runs = await client.data.SyncRun.select([...RUN_FIELDS])
          .orderBy({ startedAt: 'desc' })
          .first(1)
          .execute();

        if (cancelled) return;
        setLastRun(runs[0] ?? null);
        setInventory({
          kind: 'ready',
          artifacts,
          schedules: schedulesByArtifact,
        });
      } catch (error) {
        if (cancelled) return;
        setInventory({
          kind: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'The inventory could not be loaded.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, loadInventory]);

  const { phase, startSync } = useSync(() => {
    setReloadToken((token) => token + 1);
  });

  const renderRoute = () => {
    if (inventory.kind !== 'ready') return null;
    switch (route) {
      case 'about':
        return <About lastRun={lastRun} />;
      case 'gantt':
        return (
          <GanttView
            status={jobRuns.kind}
            errorMessage={jobRuns.kind === 'error' ? jobRuns.message : undefined}
            artifacts={inventory.artifacts}
            schedulesByArtifact={inventory.schedules}
            runs={jobRuns.kind === 'ready' ? jobRuns.runs : []}
          />
        );
      default:
        return (
          <InventoryView
            status="ready"
            artifacts={inventory.artifacts}
            schedulesByArtifact={inventory.schedules}
            lastRun={lastRun}
            onRetry={() => void loadInventory()}
          />
        );
    }
  };

  const isRunning = phase.kind === 'running';
  const hasData =
    inventory.kind === 'ready' && inventory.artifacts.length > 0;

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      {isRunning && hasData ? (
        <div
          className="bg-primary text-primary-foreground text-200 flex items-center gap-200 px-400 py-200"
          role="status"
        >
          <span
            aria-hidden="true"
            className="h-100 w-100 animate-pulse rounded-full bg-current"
          />
          Scanning workspaces for scheduled artifacts…
        </div>
      ) : null}

      {!hasData ? (
        <>
          {inventory.kind === 'error' ? (
            <div className="px-400 py-300">
              <ErrorState
                message={inventory.message}
                onRetry={() => void loadInventory()}
              />
            </div>
          ) : null}
          {phase.kind === 'failed' ? (
            <div className="px-400 py-300">
              <ErrorState message={phase.message} />
            </div>
          ) : null}
          <Home
            lastRun={lastRun}
            phase={phase}
            onSync={() => void startSync()}
          />
        </>
      ) : inventory.kind === 'ready' ? (
        <>
          {phase.kind === 'failed' ? (
            <div className="px-400 py-300">
              <ErrorState message={phase.message} />
            </div>
          ) : null}
          <AppShell
            route={route}
            onNavigate={navigate}
            lastRun={lastRun}
            artifactCount={inventory.artifacts.length}
            isSyncing={isRunning}
            onSync={() => void startSync()}
          >
            {renderRoute()}
          </AppShell>
        </>
      ) : null}
    </div>
  );
}

/** Inventory can grow past one page; loop the cursor to the end. */
async function pageAllArtifacts(
  client: Awaited<ReturnType<typeof getRayfinClient>>
): Promise<ArtifactRecord[]> {
  const artifacts: ArtifactRecord[] = [];
  let cursor: string | undefined;
  for (;;) {
    const queryBase = client.data.Artifact.select([...ARTIFACT_FIELDS])
      .where({ present: { eq: true } })
      .orderBy({ displayName: 'asc' })
      .first(100);
    const page =
      cursor === undefined
        ? await queryBase.executePaginated()
        : await queryBase.after(cursor).executePaginated();
    artifacts.push(...page.items);
    if (!page.hasNextPage || page.endCursor === undefined) break;
    cursor = page.endCursor;
  }
  return artifacts;
}

async function pageAllSchedules(
  client: Awaited<ReturnType<typeof getRayfinClient>>
): Promise<ScheduleRecord[]> {
  const schedules: ScheduleRecord[] = [];
  let cursor: string | undefined;
  for (;;) {
    const queryBase = client.data.Schedule.select([...SCHEDULE_FIELDS])
      .orderBy({ artifactRowId: 'asc' })
      .first(100);
    const page =
      cursor === undefined
        ? await queryBase.executePaginated()
        : await queryBase.after(cursor).executePaginated();
    schedules.push(...page.items);
    if (!page.hasNextPage || page.endCursor === undefined) break;
    cursor = page.endCursor;
  }
  return schedules;
}

async function pageAllJobRuns(
  client: Awaited<ReturnType<typeof getRayfinClient>>
): Promise<JobRunRecord[]> {
  const runs: JobRunRecord[] = [];
  let cursor: string | undefined;
  for (;;) {
    const queryBase = client.data.JobRun.select([...JOB_RUN_FIELDS])
      .orderBy({ artifactRowId: 'asc' })
      .first(100);
    const page =
      cursor === undefined
        ? await queryBase.executePaginated()
        : await queryBase.after(cursor).executePaginated();
    runs.push(...page.items);
    if (!page.hasNextPage || page.endCursor === undefined) break;
    cursor = page.endCursor;
  }
  return runs;
}

export default App;
