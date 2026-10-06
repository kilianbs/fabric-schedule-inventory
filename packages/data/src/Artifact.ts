//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
  authenticated,
  boolean,
  date,
  entity,
  int,
  text,
  uuid,
} from '@microsoft/rayfin-core';

/**
 * A Fabric artifact (item) whose type can carry job-scheduler schedules.
 *
 * One row per (workspace, item) pair observed during a sync that has at least
 * one schedule. Items that lose their schedules, or disappear from a
 * successfully scanned workspace, are deleted together with their schedules.
 * `present` is legacy: rows are always written as `true`.
 *
 * Schedule counts are denormalized here for fast listing; the full schedule
 * details live in the `Schedule` entity keyed by `artifactRowId`.
 *
 * Shared inventory: every authenticated app user may read and write, since
 * the scan itself always runs under the app identity and produces the same
 * rows regardless of who triggers it.
 */
@entity()
@authenticated('*')
export class Artifact {
  @uuid() id!: string;
  /** Fabric workspace GUID. */
  @text({ min: 1, max: 100 }) workspaceId!: string;
  @text({ min: 1, max: 400 }) workspaceName!: string;
  /** Workspace | Personal | AdminWorkspace. */
  @text({ max: 50 }) workspaceType!: string;
  /** Fabric item GUID. */
  @text({ min: 1, max: 100 }) itemId!: string;
  /** Fabric item type, e.g. Notebook, DataPipeline, SemanticModel. */
  @text({ min: 1, max: 100 }) itemType!: string;
  @text({ min: 1, max: 500 }) displayName!: string;
  @text({ optional: true, max: 2000 }) description?: string;
  @text({ optional: true, max: 100 }) folderId?: string;
  /** Fabric capacity GUID of the workspace; absent for personal/shared workspaces. */
  @text({ optional: true, max: 100 }) capacityId?: string;
  /** Best-effort capacity display name resolved at sync time. */
  @text({ optional: true, max: 400 }) capacityName?: string;
  /** Job types probed for this artifact, comma-separated (bounded by the scan map). */
  @text({ max: 300 }) jobTypesProbed!: string;
  /** Number of schedules found across all probed job types. */
  @int({ default: 0 }) scheduleCount!: number;
  /** Soft-delete marker: false when a later scan no longer observes this item. */
  @boolean({ default: true }) present!: boolean;
  @date() firstSeenAt!: Date;
  @date() lastSyncedAt!: Date;
}
