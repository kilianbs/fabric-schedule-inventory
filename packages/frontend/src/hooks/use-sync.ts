//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';

import type { SyncRunRecord } from '@rayfin-app/shared';

import { getRayfinClient } from '@/lib/rayfin-client';

/** A run older than this while still `running` is treated as dead. */
const STUCK_RUN_MS = 15 * 60 * 1000;

/** Poll interval while a sync is in progress. */
const POLL_INTERVAL_MS = 1_500;

export type SyncPhase =
  | { kind: 'idle' }
  | { kind: 'running'; startedAt: Date; progress?: SyncRunRecord }
  | { kind: 'completed'; summary: SyncRunRecord }
  | { kind: 'failed'; message: string; summary?: SyncRunRecord };

/**
 * Owns the sync lifecycle: invokes the server-side `syncInventory` function,
 * keeps the latest `SyncRun` row polled while the scan runs, and surfaces a
 * typed phase for the shell to render. On completion (or failure) the caller
 * refreshes entity queries.
 */
export function useSync(onFinish: () => void) {
  const [phase, setPhase] = useState<SyncPhase>({ kind: 'idle' });
  const finishedRef = useRef(onFinish);

  // Keep the latest callback without re-running the start logic; refs are
  // updated inside an effect, never during render.
  useEffect(() => {
    finishedRef.current = onFinish;
  }, [onFinish]);

  const triggeredBy = 'app user';

  /** Query the most recent SyncRun row, newest first. */
  const fetchLatestRun = useCallback(async (): Promise<SyncRunRecord | null> => {
    const client = await getRayfinClient();
    const runs = await client.data.SyncRun.select([
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
    ])
      .orderBy({ startedAt: 'desc' })
      .first(1)
      .execute();
    return runs[0] ?? null;
  }, []);

  const startSync = useCallback(async () => {
    if (phase.kind === 'running') return;
    setPhase({ kind: 'running', startedAt: new Date() });
    try {
      const client = await getRayfinClient();
      // Resolves when the scan completes; the function keeps a SyncRun row
      // updated throughout so progress is observable independently.
      await client.functions.syncInventory.invoke(
        { triggeredBy },
        { timeoutMs: 240_000 }
      );
      const latest = await fetchLatestRun();
      if (latest && latest.status === 'failed') {
        setPhase({
          kind: 'failed',
          message: latest.errorSummary ?? 'The sync failed.',
          summary: latest,
        });
      } else {
        setPhase(
          latest
            ? { kind: 'completed', summary: latest }
            : { kind: 'completed', summary: emptySummary() }
        );
      }
      finishedRef.current();
    } catch (error) {
      setPhase({
        kind: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
      finishedRef.current();
    }
  }, [phase.kind, triggeredBy, fetchLatestRun]);

  /** Load the previous run (if any) so the home view can show last-sync info. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const latest = await fetchLatestRun();
        if (cancelled || !latest || latest.status !== 'running') return;
        const startedAt = new Date(latest.startedAt);
        const isStuck = Date.now() - startedAt.getTime() > STUCK_RUN_MS;
        setPhase(
          isStuck
            ? {
                kind: 'failed',
                message: 'An earlier sync appears to have stopped.',
                summary: latest,
              }
            : { kind: 'running', startedAt, progress: latest }
        );
      } catch {
        // Previous-run context is best-effort; the empty state still renders.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchLatestRun]);

  // While running, poll the latest SyncRun row so progress stays honest even
  // if the invoke promise resolves late.
  useEffect(() => {
    if (phase.kind !== 'running') return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const latest = await fetchLatestRun();
        if (cancelled || !latest || latest.status !== 'running') return;
        const startedAt = new Date(latest.startedAt);
        if (Date.now() - startedAt.getTime() > STUCK_RUN_MS) {
          setPhase({
            kind: 'failed',
            message: 'The sync stopped responding and was marked failed.',
            summary: latest,
          });
          return;
        }
        setPhase((current) =>
          current.kind === 'running'
            ? { ...current, progress: latest }
            : current
        );
      } catch {
        // Polling errors surface through the resolve/reject of the invoke.
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [phase.kind, fetchLatestRun]);

  return { phase, startSync };
}

function emptySummary(): SyncRunRecord {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    status: 'completed',
    startedAt: new Date(),
    triggeredBy: '',
    workspacesScanned: 0,
    workspacesFailed: 0,
    artifactsFound: 0,
    schedulesFound: 0,
    errorCount: 0,
    stage: 'done',
    progressPercent: 100,
    workspacesTotal: 0,
    workspacesProcessed: 0,
  };
}
