//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ArtifactRecord } from '@rayfin-app/shared';

export interface ArtifactFilters {
  /** Case-insensitive substring of the artifact display name. */
  query: string;
  /** Exact workspace name, or '' for all. */
  workspace: string;
  /** Exact item type, or '' for all. */
  type: string;
  schedulesOnly: boolean;
}

export const DEFAULT_FILTERS: ArtifactFilters = {
  query: '',
  workspace: '',
  type: '',
  schedulesOnly: true,
};

export function isDefaultFilters(filters: ArtifactFilters): boolean {
  return (
    filters.query.trim() === DEFAULT_FILTERS.query &&
    filters.workspace === DEFAULT_FILTERS.workspace &&
    filters.type === DEFAULT_FILTERS.type &&
    filters.schedulesOnly === DEFAULT_FILTERS.schedulesOnly
  );
}

export function filterArtifacts(
  artifacts: readonly ArtifactRecord[],
  filters: ArtifactFilters
): ArtifactRecord[] {
  const query = filters.query.trim().toLowerCase();
  return artifacts.filter(
    (artifact) =>
      (query === '' ||
        (typeof artifact.displayName === 'string' &&
          artifact.displayName.toLowerCase().includes(query))) &&
      (filters.workspace === '' ||
        artifact.workspaceName === filters.workspace) &&
      (filters.type === '' || artifact.itemType === filters.type) &&
      (!filters.schedulesOnly || artifact.scheduleCount > 0)
  );
}

/** Distinct values of one field with their counts, sorted by value. */
export function countBy(
  artifacts: readonly ArtifactRecord[],
  field: 'workspaceName' | 'itemType'
): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const artifact of artifacts) {
    const value = artifact[field];
    if (typeof value !== 'string') continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, count })).sort(
    (a, b) => a.value.localeCompare(b.value)
  );
}
