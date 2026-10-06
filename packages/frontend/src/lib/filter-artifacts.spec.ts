import { describe, expect, it } from 'vitest';

import type { ArtifactRecord } from '@rayfin-app/shared';

import {
  countBy,
  DEFAULT_FILTERS,
  filterArtifacts,
  isDefaultFilters,
} from '@/lib/filter-artifacts';

const artifacts = [
  { id: 'a1', displayName: 'Sales Pipeline', workspaceName: 'Finance', itemType: 'DataPipeline', scheduleCount: 2 },
  { id: 'a2', displayName: 'Daily Notebook', workspaceName: 'Finance', itemType: 'Notebook', scheduleCount: 0 },
  { id: 'a3', displayName: 'sales model', workspaceName: 'Ops', itemType: 'SemanticModel', scheduleCount: 1 },
] as ArtifactRecord[];

const ids = (list: ArtifactRecord[]) => list.map((artifact) => artifact.id);

describe('filterArtifacts', () => {
  it('keeps every artifact by default', () => {
    expect(ids(filterArtifacts(artifacts, DEFAULT_FILTERS))).toEqual(['a1', 'a2', 'a3']);
  });

  it('searches names case-insensitively, ignoring surrounding spaces', () => {
    expect(
      ids(filterArtifacts(artifacts, { ...DEFAULT_FILTERS, query: '  SALES ' }))
    ).toEqual(['a1', 'a3']);
  });

  it('combines workspace and type filters', () => {
    expect(
      ids(
        filterArtifacts(artifacts, {
          query: '',
          workspace: 'Finance',
          type: 'Notebook',
        })
      )
    ).toEqual(['a2']);
    expect(
      ids(
        filterArtifacts(artifacts, {
          ...DEFAULT_FILTERS,
          workspace: 'Ops',
          type: 'Notebook',
        })
      )
    ).toEqual([]);
  });
});

describe('isDefaultFilters', () => {
  it('treats whitespace-only search as default', () => {
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, query: '   ' })).toBe(true);
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, type: 'Notebook' })).toBe(false);
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, workspace: 'Ops' })).toBe(false);
  });
});

describe('countBy', () => {
  it('counts distinct values sorted by name', () => {
    expect(countBy(artifacts, 'workspaceName')).toEqual([
      { value: 'Finance', count: 2 },
      { value: 'Ops', count: 1 },
    ]);
  });
});
