//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
  authenticated,
  date,
  entity,
  int,
  text,
  uuid,
} from '@microsoft/rayfin-core';

/**
 * One recent finished (Completed or Failed) Fabric job run of a scheduled
 * artifact, snapshotted during a sync.
 *
 * Rows are replaced wholesale per artifact on every sync (delete + recreate
 * keyed by `artifactRowId`), keeping only the latest runs. Timestamps are
 * stored as text exactly as returned by Fabric (UTC, no trailing `Z`).
 */
@entity()
@authenticated('*')
export class JobRun {
  @uuid() id!: string;
  /** Join key: `Artifact.id` this run belongs to. */
  @text({ min: 1, max: 100 }) artifactRowId!: string;
  @text({ min: 1, max: 100 }) workspaceId!: string;
  @text({ min: 1, max: 100 }) itemId!: string;
  @text({ max: 100 }) jobType!: string;
  /** Fabric job instance GUID. */
  @text({ min: 1, max: 100 }) jobInstanceId!: string;
  /** Manual | Scheduled. */
  @text({ max: 50 }) invokeType!: string;
  /** Completed | Failed. */
  @text({ max: 50 }) status!: string;
  @text({ min: 1, max: 50 }) startTimeUtc!: string;
  @text({ optional: true, max: 50 }) endTimeUtc?: string;
  @int({ optional: true }) durationSeconds?: number;
  @date() lastSyncedAt!: Date;
}
