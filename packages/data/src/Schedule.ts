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
 * A single Fabric item schedule, snapshotted during a sync.
 *
 * Rows are replaced wholesale per artifact on every sync (delete + recreate
 * keyed by `artifactRowId`) because they mirror Fabric-side metadata the app
 * does not own — there is no user edit to preserve. `scheduleFabricId` keeps
 * the id of the underlying Fabric schedule for reference.
 *
 * Datetimes arrive from Fabric as timezone-ambiguous ISO strings (the
 * schedule's own `localTimeZoneId` governs interpretation), so they are
 * stored as text exactly as returned — never parsed into `Date` for storage.
 * The UI renders them together with `localTimeZoneId`.
 *
 * Configuration shape varies by `configType` (Cron | Daily | Weekly |
 * Monthly); the per-type fields are serialized to bounded JSON text columns,
 * with the common fields broken out for filtering.
 */
@entity()
@authenticated('*')
export class Schedule {
  @uuid() id!: string;
  /** Fabric schedule GUID. */
  @text({ min: 1, max: 100 }) scheduleFabricId!: string;
  @text({ min: 1, max: 100 }) workspaceId!: string;
  @text({ min: 1, max: 100 }) itemId!: string;
  /** Join key: `Artifact.id` this schedule belongs to. */
  @text({ min: 1, max: 100 }) artifactRowId!: string;
  /** The job type this schedule triggers, e.g. RunNotebook, Pipeline. */
  @text({ min: 1, max: 100 }) jobType!: string;
  @boolean({ default: true }) enabled!: boolean;
  /** Cron | Daily | Weekly | Monthly. */
  @text({ max: 50 }) configType!: string;
  @text({ max: 50 }) startDateTime!: string;
  @text({ optional: true, max: 50 }) endDateTime?: string;
  /** Windows time-zone id from the Fabric schedule, e.g. "Central Standard Time". */
  @text({ optional: true, max: 100 }) localTimeZoneId?: string;
  /** Cron only: interval in minutes (1–5270400). */
  @int({ optional: true }) intervalMinutes?: number;
  /** Daily/Weekly/Monthly: time slots, JSON array of "hh:mm" strings. */
  @text({ optional: true, max: 500 }) timesJson?: string;
  /** Weekly only: weekdays, JSON array of day names. */
  @text({ optional: true, max: 200 }) weekdaysJson?: string;
  /** Monthly only: occurrence + recurrence, JSON object. */
  @text({ optional: true, max: 500 }) monthlyConfigJson?: string;
  /** Item-type-specific execution data, JSON object. */
  @text({ optional: true, max: 2000 }) executionDataJson?: string;
  /** Schedule owner principal id and type (User, ServicePrincipal, ...). */
  @text({ optional: true, max: 100 }) ownerId?: string;
  @text({ optional: true, max: 50 }) ownerType?: string;
  /** createdDateTime from Fabric, as returned (UTC ISO text). */
  @text({ optional: true, max: 50 }) createdDateTime?: string;
  @date() lastSyncedAt!: Date;
}
