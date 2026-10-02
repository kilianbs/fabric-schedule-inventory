import type { ArtifactRecord, ScheduleRecord } from '@rayfin-app/shared';

export interface InventoryTotals {
  workspaces: number;
  artifacts: number;
  schedules: number;
  enabled: number;
  disabled: number;
}

export function computeTotals(
  artifacts: readonly ArtifactRecord[],
  schedulesByArtifact: ReadonlyMap<string, readonly ScheduleRecord[]>
): InventoryTotals {
  let schedules = 0;
  let enabled = 0;
  for (const list of schedulesByArtifact.values()) {
    schedules += list.length;
    enabled += list.filter((schedule) => schedule.enabled).length;
  }
  return {
    workspaces: new Set(artifacts.map((artifact) => artifact.workspaceId)).size,
    artifacts: artifacts.length,
    schedules,
    enabled,
    disabled: schedules - enabled,
  };
}
