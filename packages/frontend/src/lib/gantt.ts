import type {
  ArtifactRecord,
  JobRunRecord,
  ScheduleRecord,
} from '@rayfin-app/shared';

import { parseJsonList } from '@/lib/schedule-format';

/**
 * "Typical day" Gantt calculations. Pure: no React, no clock except the
 * injectable `now`. Times are minutes since 00:00 in each schedule's own local
 * time zone (Windows tz ids are not converted; see `GanttModel.timeZones`).
 */

export const MINUTES_PER_DAY = 1440;
/** Bar width for artifacts without run history; the UI draws it hatched. */
export const FALLBACK_DURATION_SECONDS = 60;
/** Max occurrences per cron schedule per day (5-minute cadence). */
export const MAX_OCCURRENCES_PER_SCHEDULE = 288;

export type GroupBy = 'capacity' | 'workspace';

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** 0 = Sunday … 6 = Saturday (same as `Date#getDay`). */
export function resolveWeekday(value: number | string): number {
  if (typeof value === 'number') return ((Math.trunc(value) % 7) + 7) % 7;
  const index = WEEKDAY_NAMES.findIndex(
    (name) => name.toLowerCase() === value.trim().toLowerCase()
  );
  return index < 0 ? 0 : index;
}

export interface Duration {
  seconds: number | null;
  runsUsed: number;
}

/** Average duration of the artifact's last `count` runs that have a duration. */
export function averageDuration(
  runs: readonly JobRunRecord[],
  artifactId: string,
  count: number
): Duration {
  const recent = runs
    .filter(
      (run) =>
        run.artifactRowId === artifactId &&
        typeof run.durationSeconds === 'number'
    )
    .sort((a, b) => b.startTimeUtc.localeCompare(a.startTimeUtc))
    .slice(0, Math.max(0, count));
  if (recent.length === 0) return { seconds: null, runsUsed: 0 };
  const total = recent.reduce((sum, run) => sum + (run.durationSeconds ?? 0), 0);
  return { seconds: total / recent.length, runsUsed: recent.length };
}

export interface GanttBar {
  artifactId: string;
  scheduleId: string;
  startMin: number;
  durationMin: number;
  /** Part of a bar that crosses midnight (drawn as two segments). */
  wraps: boolean;
  hasHistory: boolean;
}

export interface GanttRow {
  artifact: ArtifactRecord;
  bars: GanttBar[];
  averageDurationSeconds: number | null;
  runsUsed: number;
  hasHistory: boolean;
  /** True when a cron schedule hit MAX_OCCURRENCES_PER_SCHEDULE. */
  truncated: boolean;
  firstStartMin: number;
}

export interface GanttGroup {
  key: string;
  label: string;
  rows: GanttRow[];
  /** Concurrent bars per minute of the day (length 1440). */
  load: number[];
  peak: { minute: number; count: number };
  /** Ids of artifacts that run at the same time as another one. */
  overlapping: string[];
}

export interface SkippedSchedule {
  artifactId: string;
  scheduleId: string;
  reason: 'monthly' | 'ended' | 'invalid';
}

export interface GanttModel {
  groups: GanttGroup[];
  skipped: SkippedSchedule[];
  /** Distinct local time zones of the drawn schedules. */
  timeZones: string[];
}

export interface GanttInput {
  artifacts: readonly ArtifactRecord[];
  schedulesByArtifact: ReadonlyMap<string, readonly ScheduleRecord[]>;
  runs: readonly JobRunRecord[];
  runCount: number;
  weekday: number | string;
  groupBy: GroupBy;
  includeDisabled?: boolean;
  now?: Date;
}

function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes < MINUTES_PER_DAY ? minutes : null;
}

function anchorMinute(startDateTime: string | undefined): number {
  const match = /T(\d{2}):(\d{2})/.exec(startDateTime ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

type Occurrences =
  | { kind: 'ok'; starts: number[]; truncated: boolean }
  | { kind: 'skip'; reason: SkippedSchedule['reason'] | null };

function occurrencesFor(
  schedule: ScheduleRecord,
  weekday: number,
  now: Date
): Occurrences {
  const type = (schedule.configType ?? '').toLowerCase();
  if (type === 'monthly') return { kind: 'skip', reason: 'monthly' };
  // Coarse validity only: a past end date means the schedule no longer fires.
  if (schedule.endDateTime) {
    const end = new Date(schedule.endDateTime);
    if (!Number.isNaN(end.getTime()) && end < now)
      return { kind: 'skip', reason: 'ended' };
  }

  if (type === 'cron') {
    const interval = schedule.intervalMinutes;
    if (typeof interval !== 'number' || interval <= 0)
      return { kind: 'skip', reason: 'invalid' };
    const starts: number[] = [];
    for (
      let minute = anchorMinute(schedule.startDateTime) % interval;
      minute < MINUTES_PER_DAY;
      minute += interval
    ) {
      starts.push(minute);
    }
    const truncated = starts.length > MAX_OCCURRENCES_PER_SCHEDULE;
    return {
      kind: 'ok',
      starts: truncated ? starts.slice(0, MAX_OCCURRENCES_PER_SCHEDULE) : starts,
      truncated,
    };
  }

  if (type === 'daily' || type === 'weekly') {
    if (type === 'weekly') {
      const days = (parseJsonList(schedule.weekdaysJson) ?? []).map((name) =>
        resolveWeekday(name)
      );
      if (!days.includes(weekday)) return { kind: 'skip', reason: null };
    }
    const starts = (parseJsonList(schedule.timesJson) ?? [])
      .map(parseTime)
      .filter((minute): minute is number => minute !== null);
    return starts.length > 0
      ? { kind: 'ok', starts, truncated: false }
      : { kind: 'skip', reason: 'invalid' };
  }
  return { kind: 'skip', reason: 'invalid' };
}

function groupOf(
  artifact: ArtifactRecord,
  groupBy: GroupBy
): { key: string; label: string } {
  if (groupBy === 'workspace') {
    const name = artifact.workspaceName || artifact.workspaceId || 'Unknown';
    return { key: name, label: name };
  }
  const id = artifact.capacityId;
  if (!id && !artifact.capacityName)
    return { key: '', label: 'No capacity' };
  return {
    key: id ?? artifact.capacityName ?? '',
    label: artifact.capacityName ?? `${id?.slice(0, 8)}…`,
  };
}

function toBars(
  artifactId: string,
  scheduleId: string,
  starts: readonly number[],
  durationMin: number,
  hasHistory: boolean
): GanttBar[] {
  return starts.flatMap((startMin): GanttBar[] => {
    const end = startMin + durationMin;
    if (end <= MINUTES_PER_DAY)
      return [{ artifactId, scheduleId, startMin, durationMin, wraps: false, hasHistory }];
    return [
      { artifactId, scheduleId, startMin, durationMin: MINUTES_PER_DAY - startMin, wraps: true, hasHistory },
      { artifactId, scheduleId, startMin: 0, durationMin: Math.min(end - MINUTES_PER_DAY, MINUTES_PER_DAY), wraps: true, hasHistory },
    ];
  });
}

function addBars(load: number[], bars: readonly GanttBar[]) {
  for (const bar of bars) {
    const end = Math.min(MINUTES_PER_DAY, Math.ceil(bar.startMin + bar.durationMin));
    for (let m = Math.floor(bar.startMin); m < end; m++) load[m] += 1;
  }
}

function summarizeGroup(key: string, label: string, rows: GanttRow[]): GanttGroup {
  const load = new Array<number>(MINUTES_PER_DAY).fill(0);
  const ownLoads = rows.map((row) => {
    const own = new Array<number>(MINUTES_PER_DAY).fill(0);
    addBars(own, row.bars);
    return own;
  });
  for (const own of ownLoads) own.forEach((n, m) => (load[m] += n));

  const peak = { minute: 0, count: 0 };
  load.forEach((count, minute) => {
    if (count > peak.count) {
      peak.minute = minute;
      peak.count = count;
    }
  });

  // An artifact overlaps when, at some minute it runs, others run too.
  const overlapping = rows
    .filter((_, i) => ownLoads[i].some((n, m) => n > 0 && load[m] > n))
    .map((row) => row.artifact.id);

  rows.sort((a, b) => a.firstStartMin - b.firstStartMin);
  return { key, label, rows, load, peak, overlapping };
}

export function buildGantt(input: GanttInput): GanttModel {
  const weekday = resolveWeekday(input.weekday);
  const now = input.now ?? new Date();
  const skipped: SkippedSchedule[] = [];
  const zones = new Set<string>();
  const grouped = new Map<string, { label: string; rows: GanttRow[] }>();

  for (const artifact of input.artifacts) {
    const duration = averageDuration(input.runs, artifact.id, input.runCount);
    const hasHistory = duration.seconds !== null;
    const durationMin =
      (duration.seconds ?? FALLBACK_DURATION_SECONDS) / 60;
    const bars: GanttBar[] = [];
    let truncated = false;

    for (const schedule of input.schedulesByArtifact.get(artifact.id) ?? []) {
      if (!schedule.enabled && !input.includeDisabled) continue;
      const result = occurrencesFor(schedule, weekday, now);
      if (result.kind === 'skip') {
        if (result.reason)
          skipped.push({
            artifactId: artifact.id,
            scheduleId: schedule.id,
            reason: result.reason,
          });
        continue;
      }
      truncated ||= result.truncated;
      if (schedule.localTimeZoneId) zones.add(schedule.localTimeZoneId);
      bars.push(
        ...toBars(artifact.id, schedule.id, result.starts, durationMin, hasHistory)
      );
    }
    if (bars.length === 0) continue;

    const { key, label } = groupOf(artifact, input.groupBy);
    const bucket = grouped.get(key) ?? { label, rows: [] };
    bucket.rows.push({
      artifact,
      bars,
      averageDurationSeconds: duration.seconds,
      runsUsed: duration.runsUsed,
      hasHistory,
      truncated,
      firstStartMin: Math.min(...bars.map((bar) => bar.startMin)),
    });
    grouped.set(key, bucket);
  }

  const groups = Array.from(grouped, ([key, { label, rows }]) =>
    summarizeGroup(key, label, rows)
  ).sort(
    (a, b) => b.peak.count - a.peak.count || a.label.localeCompare(b.label)
  );

  return { groups, skipped, timeZones: Array.from(zones).sort() };
}

export function formatClock(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = Math.floor(minute % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'no history';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${rest} min`;
}
