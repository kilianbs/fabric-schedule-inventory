import {
  AudienceType,
  UserDataFunctions,
  type RayfinContext,
} from '@microsoft/fabric-user-data-functions';
import type { UniversalAppSchema } from '@rayfin-app/shared';

import {
  type FabricCapacity,
  isSchedulableType,
  listAll,
  listItemSchedules,
  mapWithConcurrency,
  SCHEDULABLE_ITEM_TYPES,
  type FabricItem,
  type FabricItemSchedule,
  type FabricWorkspace,
} from './fabric-scan.js';

const udf = new UserDataFunctions();

/** How many items are probed for schedules concurrently per workspace. */
const PROBE_CONCURRENCY = 4;

/** Maximum sanitized error notes kept in the summary. */
const MAX_SUMMARY_ERRORS = 10;

/** Minimum gap between progress writes within the same stage. */
const PROGRESS_MIN_INTERVAL_MS = 2_000;

/** Poll hints the frontend can rely on without parsing rows. */
export interface SyncSummary {
  status: 'completed' | 'failed';
  workspacesScanned: number;
  workspacesFailed: number;
  artifactsFound: number;
  schedulesFound: number;
  errors: string[];
}

interface ArtifactObservation {
  workspace: FabricWorkspace;
  item: FabricItem;
  schedulesByJobType: Map<string, FabricItemSchedule[]>;
  jobTypesProbed: readonly string[];
}

/**
 * Scan every workspace the app identity can access, keep only artifacts whose
 * item type can carry schedules, and persist their metadata (including full
 * schedule details) as the app's inventory.
 *
 * Progress is observable through the `SyncRun` row this function writes
 * before scanning and finalizes afterwards. The Fabric scan runs under the
 * app identity (Fabric app item owner); persistence uses the caller's Rayfin
 * token and ordinary entity permissions.
 */
async function runSyncInventory(
  triggeredBy: string,
  ctx: RayfinContext<UniversalAppSchema, AudienceType.Fabric>
): Promise<SyncSummary> {
  const token = ctx.Tokens.Fabric;
  const data = ctx.getDataClient();

  const started = new Date();
  const run = await data.SyncRun.create({
    status: 'running',
    startedAt: started,
    triggeredBy: triggeredBy.slice(0, 200),
    workspacesScanned: 0,
    workspacesFailed: 0,
    artifactsFound: 0,
    schedulesFound: 0,
    errorCount: 0,
    stage: 'connect',
    progressPercent: 0,
    workspacesTotal: 0,
    workspacesProcessed: 0,
  });

  let lastReportAt = 0;
  let lastStage = 'connect';
  const reportProgress = async (
    stage: string,
    progressPercent: number,
    extra: { workspacesTotal?: number; workspacesProcessed?: number } = {}
  ): Promise<void> => {
    const now = Date.now();
    if (stage === lastStage && now - lastReportAt < PROGRESS_MIN_INTERVAL_MS) {
      return;
    }
    lastReportAt = now;
    lastStage = stage;
    // Progress is cosmetic; a failed write must never abort the scan.
    await data.SyncRun.update(
      { id: run.id },
      { stage, progressPercent: Math.min(99, Math.round(progressPercent)), ...extra }
    ).catch(() => undefined);
  };
  const errors: string[] = [];
  const recordError = (note: string): void => {
    if (errors.length < MAX_SUMMARY_ERRORS) errors.push(note.slice(0, 200));
  };

  try {
    const workspacesResult = await listAll<FabricWorkspace>(
      '/workspaces',
      token
    );
    if (!workspacesResult.ok) {
      throw new FabricScanError(
        `Could not list workspaces (status ${workspacesResult.status}). Check the app identity's Fabric access.`
      );
    }
    const workspaces = workspacesResult.value;
    const workspacesTotal = workspaces.length;
    await reportProgress('discover', 5, { workspacesTotal });

    // Best effort: capacity display names (id -> name). A failure here (the
    // app identity may lack capacity access) only leaves names undefined.
    const capacityNames = new Map<string, string>();
    const capacitiesResult = await listAll<FabricCapacity>('/capacities', token);
    if (capacitiesResult.ok) {
      for (const capacity of capacitiesResult.value) {
        if (typeof capacity?.id === 'string' && capacity.displayName) {
          capacityNames.set(capacity.id.toLowerCase(), capacity.displayName);
        }
      }
    }

    let workspacesScanned = 0;
    let workspacesFailed = 0;
    let artifactsFound = 0;
    let schedulesFound = 0;
    const observations: ArtifactObservation[] = [];
    const scannedWorkspaceIds = new Set<string>();

    for (const [workspaceIndex, workspace] of workspaces.entries()) {
      await reportProgress(
        'discover',
        5 + (workspaceIndex / Math.max(1, workspacesTotal)) * 60,
        { workspacesProcessed: workspaceIndex }
      );
      const workspaceId = workspace.id;
      if (typeof workspaceId !== 'string' || workspaceId.length === 0) continue;
      const itemsResult = await listAll<FabricItem>(
        `/workspaces/${workspaceId}/items`,
        token
      );
      if (!itemsResult.ok) {
        workspacesFailed++;
        recordError(`Workspace ${workspaceId}: could not list items.`);
        continue;
      }
      workspacesScanned++;
      scannedWorkspaceIds.add(workspaceId);
      const candidates = itemsResult.value.filter(
        (item) => typeof item.type === 'string' && isSchedulableType(item.type)
      );

      await mapWithConcurrency(candidates, PROBE_CONCURRENCY, async (item) => {
        const jobTypes =
          SCHEDULABLE_ITEM_TYPES.get(item.type as string) ?? [];
        const schedulesByJobType = new Map<string, FabricItemSchedule[]>();
        for (const jobType of jobTypes) {
          const probe = await listItemSchedules(
            workspaceId,
            item.id,
            jobType,
            token
          );
          // Expected probe outcomes (invalid job type, missing item,
          // throttling) surface as zero schedules, never as scan errors.
          schedulesByJobType.set(
            jobType,
            probe.schedules.filter((schedule) => typeof schedule?.id === 'string')
          );
        }
        // Only artifacts with at least one schedule are inventoried.
        if ([...schedulesByJobType.values()].some((s) => s.length > 0)) {
          observations.push({
            workspace,
            item,
            schedulesByJobType,
            jobTypesProbed: jobTypes,
          });
        }
      });
    }

    // Persist observations: upsert artifacts, replace their schedules.
    await reportProgress('persist', 65, {
      workspacesProcessed: workspacesTotal,
    });
    const existingByWorkspaceItem = new Map<
      string,
      { id: string; present: boolean }
    >();
    // Inventory can grow past one page; page through the full set.
    const existingArtifacts = await data.Artifact.select([
      'id',
      'workspaceId',
      'itemId',
      'present',
    ])
      .first(100)
      .executePaginated();
    let artifactPage = existingArtifacts;
    for (;;) {
      for (const artifact of artifactPage.items) {
        existingByWorkspaceItem.set(
          artifactKey(artifact.workspaceId, artifact.itemId),
          { id: artifact.id, present: artifact.present }
        );
      }
      if (!artifactPage.hasNextPage) break;
      const cursor = artifactPage.endCursor;
      if (cursor === undefined) break;
      artifactPage = await data.Artifact.select([
        'id',
        'workspaceId',
        'itemId',
        'present',
      ])
        .first(100)
        .after(cursor)
        .executePaginated();
    }

    for (const observation of observations) {
      await reportProgress(
        'persist',
        65 + (artifactsFound / Math.max(1, observations.length)) * 25
      );
      const { workspace, item, schedulesByJobType, jobTypesProbed } =
        observation;
      const workspaceId = workspace.id;
      const itemId = item.id;
      const allSchedules = [...schedulesByJobType.values()].flat();
      const existing = existingByWorkspaceItem.get(
        artifactKey(workspaceId, itemId)
      );

      const artifactFields = {
        workspaceId: workspaceId.slice(0, 100),
        workspaceName: (workspace.displayName ?? '').slice(0, 400),
        workspaceType: (workspace.type ?? '').slice(0, 50),
        itemId: itemId.slice(0, 100),
        itemType: (item.type ?? '').slice(0, 100),
        displayName: (item.displayName ?? itemId).slice(0, 500),
        description: item.description?.slice(0, 2000),
        folderId: typeof item.folderId === 'string' ? item.folderId.slice(0, 100) : undefined,
        capacityId:
          typeof workspace.capacityId === 'string'
            ? workspace.capacityId.slice(0, 100)
            : undefined,
        capacityName:
          typeof workspace.capacityId === 'string'
            ? capacityNames.get(workspace.capacityId.toLowerCase())?.slice(0, 400)
            : undefined,
        jobTypesProbed: jobTypesProbed.join(',').slice(0, 300),
        scheduleCount: allSchedules.length,
        present: true,
        lastSyncedAt: new Date(),
      };

      let artifactId: string;
      if (existing) {
        await data.Artifact.update({ id: existing.id }, artifactFields);
        artifactId = existing.id;
      } else {
        const created = await data.Artifact.create({
          ...artifactFields,
          firstSeenAt: new Date(),
        });
        artifactId = created.id;
      }

      // Schedules are replaced wholesale: they mirror Fabric-side metadata
      // the app does not own, keyed to this sync's snapshot.
      const staleSchedules = await data.Schedule.findMany({
        artifactRowId: { eq: artifactId },
      });
      for (const stale of staleSchedules) {
        await data.Schedule.delete({ id: stale.id });
      }
      for (const [jobType, schedules] of schedulesByJobType) {
        for (const schedule of schedules) {
          await data.Schedule.create(
            scheduleRecord(artifactId, workspaceId, itemId, jobType, schedule)
          );
        }
      }
      artifactsFound++;
      schedulesFound += allSchedules.length;
    }

    // Delete artifacts (with their schedules) that no longer have schedules
    // or no longer exist in successfully scanned workspaces. Workspaces that
    // failed to scan are left alone, except legacy soft-hidden rows
    // (`present: false`), which are purged unconditionally.
    await reportProgress('reconcile', 90);
    const observedKeys = new Set(
      observations.map((observation) =>
        artifactKey(observation.workspace.id, observation.item.id)
      )
    );
    let deleteFailures = 0;
    for (const [key, existing] of existingByWorkspaceItem) {
      if (observedKeys.has(key)) continue;
      const [workspaceOfArtifact] = key.split('|');
      if (existing.present && !scannedWorkspaceIds.has(workspaceOfArtifact)) {
        continue;
      }
      try {
        const staleSchedules = await data.Schedule.findMany({
          artifactRowId: { eq: existing.id },
        });
        for (const stale of staleSchedules) {
          await data.Schedule.delete({ id: stale.id });
        }
        await data.Artifact.delete({ id: existing.id });
      } catch {
        deleteFailures++;
      }
    }
    if (deleteFailures > 0) {
      recordError(`Could not remove ${deleteFailures} outdated artifact(s).`);
    }

    const summary: SyncSummary = {
      status: 'completed',
      workspacesScanned,
      workspacesFailed,
      artifactsFound,
      schedulesFound,
      errors,
    };

    await data.SyncRun.update(
      { id: run.id },
      {
        status: 'completed',
        finishedAt: new Date(),
        stage: 'done',
        progressPercent: 100,
        workspacesTotal,
        workspacesProcessed: workspacesTotal,
        workspacesScanned,
        workspacesFailed,
        artifactsFound,
        schedulesFound,
        errorCount: errors.length,
        errorSummary: errors.join(' | ').slice(0, 2000) || undefined,
      }
    );
    return summary;
  } catch (error) {
    // Surface a sanitized message; never leak tokens or provider internals.
    const message =
      error instanceof FabricScanError
        ? error.message
        : 'The sync failed unexpectedly.';
    recordError(message);

    await data.SyncRun.update(
      { id: run.id },
      {
        status: 'failed',
        finishedAt: new Date(),
        errorCount: errors.length,
        errorSummary: errors.join(' | ').slice(0, 2000) || undefined,
      }
    ).catch(() => undefined);

    const summary: SyncSummary = {
      status: 'failed',
      workspacesScanned: 0,
      workspacesFailed: 0,
      artifactsFound: 0,
      schedulesFound: 0,
      errors,
    };
    return summary;
  }
}

function artifactKey(workspaceId: string, itemId: string): string {
  return `${workspaceId}|${itemId}`;
}

/** Build a Schedule record from a Fabric schedule, clamped to field bounds. */
function scheduleRecord(
  artifactRowId: string,
  workspaceId: string,
  itemId: string,
  jobType: string,
  schedule: FabricItemSchedule
) {
  const configuration = schedule.configuration ?? {};
  const times =
    Array.isArray(configuration.times) &&
    configuration.times.every((entry) => typeof entry === 'string')
      ? (configuration.times as string[])
      : undefined;
  const weekdays =
    Array.isArray(configuration.weekdays) &&
    configuration.weekdays.every((entry) => typeof entry === 'string')
      ? (configuration.weekdays as string[])
      : undefined;
  const monthlyConfig =
    configuration.occurrence !== undefined || configuration.recurrence !== undefined
      ? safeJson({ occurrence: configuration.occurrence ?? null, recurrence: configuration.recurrence ?? null })
      : undefined;

  return {
    scheduleFabricId: schedule.id.slice(0, 100),
    workspaceId: workspaceId.slice(0, 100),
    itemId: itemId.slice(0, 100),
    artifactRowId: artifactRowId.slice(0, 100),
    jobType: jobType.slice(0, 100),
    enabled: schedule.enabled !== false,
    configType: (configuration.type ?? '').slice(0, 50),
    startDateTime: (configuration.startDateTime ?? '').slice(0, 50),
    endDateTime: configuration.endDateTime?.slice(0, 50),
    localTimeZoneId: configuration.localTimeZoneId?.slice(0, 100),
    intervalMinutes:
      typeof configuration.interval === 'number' &&
      Number.isFinite(configuration.interval)
        ? Math.trunc(configuration.interval)
        : undefined,
    timesJson: times ? safeJson(times.slice(0, 100))?.slice(0, 500) : undefined,
    weekdaysJson: weekdays
      ? safeJson(weekdays.slice(0, 7))?.slice(0, 200)
      : undefined,
    monthlyConfigJson: monthlyConfig?.slice(0, 500),
    executionDataJson:
      schedule.executionData !== undefined
        ? safeJson(schedule.executionData)?.slice(0, 2000)
        : undefined,
    ownerId: schedule.owner?.id?.slice(0, 100),
    ownerType: schedule.owner?.type?.slice(0, 50),
    createdDateTime: schedule.createdDateTime?.slice(0, 50),
    lastSyncedAt: new Date(),
  };
}

function safeJson(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

/** Error type carrying a sanitized, user-presentable message. */
class FabricScanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FabricScanError';
  }
}

udf.func(
  'syncInventory',
  async (
    triggeredBy: string,
    ctx: RayfinContext<UniversalAppSchema, AudienceType.Fabric>
  ): Promise<SyncSummary> => runSyncInventory(triggeredBy, ctx),
  []
);
