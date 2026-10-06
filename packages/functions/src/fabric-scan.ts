//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

/**
 * Fabric REST API scanning for the schedule-inventory sync.
 *
 * All calls run under the application identity's Fabric token
 * (`ctx.Tokens.Fabric`, audience `AudienceType.Fabric`), which for current
 * Fabric apps is the owner of the Fabric app item — so the scan reaches
 * exactly the workspaces that identity can access.
 *
 * Every request is bounded (timeout, page count, retries) and every error is
 * surfaced as a typed outcome. No tokens, raw response bodies, or provider
 * internals ever leave this module through logs or thrown messages.
 */

/** Base URL of the Fabric Core REST API (v1). Fixed, not configurable. */
export const FABRIC_API_BASE = 'https://api.fabric.microsoft.com/v1';

/** Upper bound on pages followed per list endpoint, as a runaway guard. */
const MAX_PAGES_PER_LIST = 200;

/** Per-request timeout for a single Fabric API call. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Maximum retries for a throttled (429) request, after honoring Retry-After. */
const MAX_THROTTLE_RETRIES = 2;

/** Cap on a single Retry-After wait, to keep the scan bounded. */
const MAX_RETRY_AFTER_SECONDS = 60;

/**
 * Item types whose artifacts the scan considers schedule-capable, mapped to
 * the job types to probe.
 *
 * The first five mappings are documented (Fabric REST / Data Factory /
 * notebook API references). The remainder use `DefaultJob`, the job type the
 * Job Scheduler API examples use for items with a single job — a best-effort
 * curated list per this app's agreed scope. An unverified probe is not an
 * error: when Fabric rejects a job type (or returns no schedules), the item
 * is still recorded with zero schedules.
 */
export const SCHEDULABLE_ITEM_TYPES: ReadonlyMap<string, readonly string[]> =
  new Map([
    ['Notebook', ['RunNotebook']],
    ['DataPipeline', ['Pipeline']],
    ['Dataflow', ['Refresh', 'Publish']],
    ['CopyJob', ['Execute', 'DefaultJob']],
    ['Lakehouse', ['TableMaintenance']],
    ['SemanticModel', ['DefaultJob']],
    ['SparkJobDefinition', ['DefaultJob']],
    ['Environment', ['DefaultJob']],
    ['MirroredDatabase', ['DefaultJob']],
    ['Eventhouse', ['DefaultJob']],
    ['SQLDatabase', ['DefaultJob']],
    ['VariableLibrary', ['DefaultJob']],
    ['WarehouseSnapshot', ['DefaultJob']],
  ]);

/** Which Fabric item types the scan should list for a workspace. */
export function isSchedulableType(itemType: string): boolean {
  return SCHEDULABLE_ITEM_TYPES.has(itemType);
}

export interface FabricWorkspace {
  id: string;
  displayName?: string;
  description?: string;
  type?: string;
  /** Absent for personal / shared-capacity workspaces. */
  capacityId?: string;
}

export interface FabricCapacity {
  id: string;
  displayName?: string;
}

export interface FabricItem {
  id: string;
  displayName?: string;
  description?: string;
  type?: string;
  workspaceId?: string;
  folderId?: string;
}

export interface FabricItemSchedule {
  id: string;
  enabled?: boolean;
  createdDateTime?: string;
  /** Discriminated by `configuration.type`. */
  configuration?: FabricScheduleConfiguration;
  executionData?: Record<string, unknown>;
  owner?: { id?: string; type?: string };
}

export type FabricScheduleConfiguration = {
  type?: string;
  startDateTime?: string;
  endDateTime?: string;
  localTimeZoneId?: string;
  /** Cron. */
  interval?: number;
  /** Daily / Weekly / Monthly. */
  times?: string[];
  /** Weekly. */
  weekdays?: string[];
  /** Monthly. */
  occurrence?: Record<string, unknown>;
  recurrence?: number;
};

/** Sanitized error kinds a Fabric call can fail with. */
export type FabricErrorKind =
  | 'not-found'
  | 'forbidden'
  | 'invalid-job-type'
  | 'throttled'
  | 'network'
  | 'server';

/** Typed safe outcome for one Fabric REST call. */
export type FabricCall<T> =
  | { ok: true; value: T }
  | { ok: false; error: FabricErrorKind; status: number };

/**
 * Perform a bounded GET against the Fabric REST API.
 *
 * - Honors 429 `Retry-After` with bounded retries.
 * - Times out individual requests.
 * - Classifies failures into a sanitized {@link FabricErrorKind}; a rejected
 *   job type surfaces as `invalid-job-type` so probe callers can treat it as
 *   a normal "no schedules" outcome.
 */
export async function fabricGet<T>(
  path: string,
  token: string
): Promise<FabricCall<T>> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${FABRIC_API_BASE}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timer);
      return { ok: false, error: 'network', status: 0 };
    }
    clearTimeout(timer);

    if (response.status === 429) {
      if (attempt < MAX_THROTTLE_RETRIES) {
        await sleep(
          Math.min(readRetryAfterSeconds(response), MAX_RETRY_AFTER_SECONDS) *
            1000
        );
        continue;
      }
      return { ok: false, error: 'throttled', status: 429 };
    }
    if (response.status === 404) {
      return { ok: false, error: 'not-found', status: 404 };
    }
    if (response.status === 403) {
      return { ok: false, error: 'forbidden', status: 403 };
    }
    if (response.status >= 200 && response.status < 300) {
      try {
        const body = (await response.json()) as T;
        return { ok: true, value: body };
      } catch {
        return { ok: false, error: 'server', status: response.status };
      }
    }
    // Fabric reports an unsupported job type for the item as 400 with an
    // InvalidJobType error code; classify without reading the body.
    if (response.status === 400) {
      return { ok: false, error: 'invalid-job-type', status: 400 };
    }
    return { ok: false, error: 'server', status: response.status };
  }
}

interface Page<T> {
  value?: T[];
  continuationToken?: string;
}

/**
 * List every record behind a paginated Fabric collection endpoint as a flat
 * array. Follows `continuationToken` links up to {@link MAX_PAGES_PER_LIST}
 * pages. The first page failing returns that failure untouched; callers
 * decide how an unreachable collection should be handled.
 */
export async function listAll<T>(
  path: string,
  token: string
): Promise<FabricCall<T[]>> {
  const results: T[] = [];
  const separator = path.includes('?') ? '&' : '?';

  const first: FabricCall<Page<T>> = await fabricGet<Page<T>>(path, token);
  if (!first.ok) {
    return { ok: false, error: first.error, status: first.status };
  }
  let current: Page<T> = first.value;
  results.push(...(current.value ?? []));

  for (let pages = 1; pages < MAX_PAGES_PER_LIST; pages++) {
    const continuationToken: string | undefined = current.continuationToken;
    if (
      typeof continuationToken !== 'string' ||
      continuationToken.length === 0
    ) {
      break;
    }
    const next: FabricCall<Page<T>> = await fabricGet<Page<T>>(
      `${path}${separator}continuationToken=${encodeURIComponent(continuationToken)}`,
      token
    );
    if (!next.ok) {
      return { ok: false, error: next.error, status: next.status };
    }
    current = next.value;
    results.push(...(current.value ?? []));
  }
  return { ok: true, value: results };
}

/**
 * Fetch all schedules for one item/jobType pair.
 *
 * Probe outcomes other than success return an empty schedule list with the
 * sanitized `probeError` marker, so an unsupported job type, a missing item,
 * a throttled call, or a permission gap degrades to "no schedules" instead
 * of failing the scan.
 */
export async function listItemSchedules(
  workspaceId: string,
  itemId: string,
  jobType: string,
  token: string
): Promise<{ schedules: FabricItemSchedule[]; probeError?: FabricErrorKind }> {
  const call = await listAll<FabricItemSchedule>(
    `/workspaces/${workspaceId}/items/${itemId}/jobs/${encodeURIComponent(jobType)}/schedules`,
    token
  );
  if (!call.ok) {
    return { schedules: [], probeError: call.error };
  }
  return { schedules: call.value };
}

/**
 * Process `items` through `worker` with at most `limit` in flight.
 * The returned array preserves input order. Workers must not throw — they
 * report their own failures through their return values.
 */
export async function mapWithConcurrency<TIn, TOut>(
  items: readonly TIn[],
  limit: number,
  worker: (item: TIn, index: number) => Promise<TOut>
): Promise<TOut[]> {
  const results = new Array<TOut>(items.length);
  let next = 0;

  async function runLane(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  const lanes = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: lanes }, () => runLane()));
  return results;
}

function readRetryAfterSeconds(response: Response): number {
  const raw = response.headers.get('Retry-After');
  const parsed = raw !== null ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  // Sensible default when the header is absent or unparseable.
  return 5;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
