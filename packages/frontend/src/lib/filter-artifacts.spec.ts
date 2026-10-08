import { describe, expect, it } from 'vitest';

import type { ArtifactRecord } from '@rayfin-app/shared';

import {
  capacityOptions,
  countBy,
  NO_CAPACITY,
  DEFAULT_FILTERS,
  filterArtifacts,
  isDefaultFilters,
} from '@/lib/filter-artifacts';

const artifacts = [
  { id: 'a1', displayName: 'Sales Pipeline', workspaceName: 'Finance', itemType: 'DataPipeline', scheduleCount: 2, capacityId: 'cap-prod', capacityName: 'Prod' },
  { id: 'a2', displayName: 'Daily Notebook', workspaceName: 'Finance', itemType: 'Notebook', scheduleCount: 0, capacityId: 'cap-prod', capacityName: 'Prod' },
  { id: 'a3', displayName: 'sales model', workspaceName: 'Ops', itemType: 'SemanticModel', scheduleCount: 1, capacityId: '0123456789abcdef' },
  { id: 'a4', displayName: 'Trial report', workspaceName: 'Sandbox', itemType: 'Notebook', scheduleCount: 1 },
] as ArtifactRecord[];

const ids = (list: ArtifactRecord[]) => list.map((artifact) => artifact.id);

describe('filterArtifacts', () => {
  it('keeps every artifact by default', () => {
    expect(ids(filterArtifacts(artifacts, DEFAULT_FILTERS))).toEqual(['a1', 'a2', 'a3', 'a4']);
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
          capacity: '',
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

  it('filters by capacity, including artifacts without one', () => {
    expect(
      ids(filterArtifacts(artifacts, { ...DEFAULT_FILTERS, capacity: 'cap-prod' }))
    ).toEqual(['a1', 'a2']);
    expect(
      ids(filterArtifacts(artifacts, { ...DEFAULT_FILTERS, capacity: NO_CAPACITY }))
    ).toEqual(['a4']);
    expect(
      ids(
        filterArtifacts(artifacts, {
          ...DEFAULT_FILTERS,
          capacity: 'cap-prod',
          workspace: 'Ops',
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
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, capacity: 'cap-prod' })).toBe(false);
  });
});

describe('countBy', () => {
  it('counts distinct values sorted by name', () => {
    expect(countBy(artifacts, 'workspaceName')).toEqual([
      { value: 'Finance', count: 2 },
      { value: 'Ops', count: 1 },
      { value: 'Sandbox', count: 1 },
    ]);
  });
});

describe('capacityOptions', () => {
  it('labels capacities, flags unresolved names and keeps "no capacity" selectable', () => {
    expect(capacityOptions(artifacts)).toEqual([
      { value: '0123456789abcdef', label: 'Capacity 01234567 (name unavailable)', count: 1 },
      { value: NO_CAPACITY, label: 'No capacity', count: 1 },
      { value: 'cap-prod', label: 'Prod', count: 2 },
    ]);
  });
});
