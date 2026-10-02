/**
 * Browser-safe contracts shared by the data registration package and frontend.
 *
 * Keep each record shape aligned with its decorated runtime entity in
 * `@rayfin-app/data`. This package must stay isomorphic, so do not import the
 * decorated classes here.
 */
export interface ArtifactRecord {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceType: string;
  itemId: string;
  itemType: string;
  displayName: string;
  description?: string;
  folderId?: string;
  jobTypesProbed: string;
  scheduleCount: number;
  present: boolean;
  firstSeenAt: Date;
  lastSyncedAt: Date;
}

export interface ScheduleRecord {
  id: string;
  scheduleFabricId: string;
  workspaceId: string;
  itemId: string;
  artifactRowId: string;
  jobType: string;
  enabled: boolean;
  configType: string;
  startDateTime: string;
  endDateTime?: string;
  localTimeZoneId?: string;
  intervalMinutes?: number;
  timesJson?: string;
  weekdaysJson?: string;
  monthlyConfigJson?: string;
  executionDataJson?: string;
  ownerId?: string;
  ownerType?: string;
  createdDateTime?: string;
  lastSyncedAt: Date;
}

export interface SyncRunRecord {
  id: string;
  status: string;
  startedAt: Date;
  finishedAt?: Date;
  triggeredBy: string;
  workspacesScanned: number;
  workspacesFailed: number;
  artifactsFound: number;
  schedulesFound: number;
  errorCount: number;
  stage: string;
  progressPercent: number;
  workspacesTotal: number;
  workspacesProcessed: number;
  errorSummary?: string;
}

export type UniversalAppSchema = {
  Artifact: ArtifactRecord;
  Schedule: ScheduleRecord;
  SyncRun: SyncRunRecord;
};
