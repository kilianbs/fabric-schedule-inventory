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
 * One execution of the inventory sync, used as the run log and progress signal.
 *
 * The sync function creates a row with status `running` before scanning and
 * updates it to `completed` or `failed` at the end. The frontend polls the
 * latest row to render progress, and treats a `running` row older than the
 * stuck-run guard window as failed so a terminated scan can never wedge the
 * UI in a loading state.
 */
@entity()
@authenticated('*')
export class SyncRun {
  @uuid() id!: string;
  /** running | completed | failed. */
  @text({ max: 20 }) status!: string;
  @date() startedAt!: Date;
  @date({ optional: true }) finishedAt?: Date;
  /** Display name or id of the app user who triggered the sync. */
  @text({ max: 200 }) triggeredBy!: string;
  @int({ default: 0 }) workspacesScanned!: number;
  @int({ default: 0 }) workspacesFailed!: number;
  @int({ default: 0 }) artifactsFound!: number;
  @int({ default: 0 }) schedulesFound!: number;
  @int({ default: 0 }) errorCount!: number;
  /** connect | discover | persist | reconcile | done. */
  @text({ max: 20, default: 'connect' }) stage!: string;
  @int({ default: 0 }) progressPercent!: number;
  @int({ default: 0 }) workspacesTotal!: number;
  @int({ default: 0 }) workspacesProcessed!: number;
  /** Bounded, sanitized error summaries (no tokens or response bodies). */
  @text({ optional: true, max: 2000 }) errorSummary?: string;
}
