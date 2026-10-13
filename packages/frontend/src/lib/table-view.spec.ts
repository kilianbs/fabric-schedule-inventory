import { describe, expect, it } from 'vitest';

import { nextSort, pageItems, paginate, sortRows } from '@/lib/table-view';

interface Item {
  name: string;
  count: number | null;
}

const items: Item[] = [
  { name: 'beta', count: 2 },
  { name: 'Alpha', count: 5 },
  { name: 'item 10', count: 2 },
  { name: 'item 9', count: null },
];

const valueOf = (item: Item, key: 'name' | 'count') => item[key];
const names = (list: Item[]) => list.map((item) => item.name);

describe('sortRows', () => {
  it('sorts text case-insensitively with natural numbers', () => {
    expect(names(sortRows(items, { key: 'name', direction: 'asc' }, valueOf))).toEqual([
      'Alpha',
      'beta',
      'item 9',
      'item 10',
    ]);
  });

  it('sorts numbers, keeps missing values last and breaks ties by name', () => {
    expect(
      names(sortRows(items, { key: 'count', direction: 'desc' }, valueOf, 'name'))
    ).toEqual(['Alpha', 'beta', 'item 10', 'item 9']);
    expect(
      names(sortRows(items, { key: 'count', direction: 'asc' }, valueOf, 'name'))
    ).toEqual(['beta', 'item 10', 'Alpha', 'item 9']);
  });

  it('does not mutate the input', () => {
    const copy = [...items];
    sortRows(items, { key: 'name', direction: 'desc' }, valueOf);
    expect(items).toEqual(copy);
  });
});

describe('nextSort', () => {
  it('starts a new column at its default and flips the same column', () => {
    const start = { key: 'count' as const, direction: 'desc' as const };
    expect(nextSort(start, 'name', 'asc')).toEqual({ key: 'name', direction: 'asc' });
    expect(nextSort(start, 'count', 'desc')).toEqual({ key: 'count', direction: 'asc' });
  });
});

describe('paginate', () => {
  const rows = Array.from({ length: 45 }, (_, index) => index + 1);

  it('slices a page and reports the visible range', () => {
    expect(paginate(rows, 2, 20)).toMatchObject({
      page: 2,
      pageCount: 3,
      from: 21,
      to: 40,
      total: 45,
    });
    expect(paginate(rows, 3, 20).rows).toEqual([41, 42, 43, 44, 45]);
  });

  it('clamps out-of-range pages and handles no rows', () => {
    expect(paginate(rows, 9, 20).page).toBe(3);
    expect(paginate(rows, 0, 20).page).toBe(1);
    expect(paginate([], 1, 20)).toMatchObject({ page: 1, pageCount: 1, from: 0, to: 0 });
  });
});

describe('pageItems', () => {
  it('shows every page when there are few', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it('collapses distant pages into gaps around the current one', () => {
    expect(pageItems(1, 10)).toEqual([1, 2, 'gap', 10]);
    expect(pageItems(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageItems(10, 10)).toEqual([1, 'gap', 9, 10]);
  });

  it('shows a single skipped page instead of a gap', () => {
    expect(pageItems(4, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 10]);
  });
});
