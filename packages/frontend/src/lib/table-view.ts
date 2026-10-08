export type SortDirection = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

export type SortValue = string | number | null | undefined;

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function isMissing(value: SortValue): value is null | undefined | '' {
  return value === null || value === undefined || value === '';
}

/** Ascending comparison; missing values sort after everything else. */
function compareValues(a: SortValue, b: SortValue): number {
  if (isMissing(a) || isMissing(b))
    return isMissing(a) === isMissing(b) ? 0 : isMissing(a) ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/**
 * Stable sort by one key; ties keep the order of `tieBreak` (ascending), then
 * the input order.
 */
export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: SortState<K>,
  valueOf: (row: T, key: K) => SortValue,
  tieBreak?: K
): T[] {
  const factor = sort.direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const av = valueOf(a.row, sort.key);
      const bv = valueOf(b.row, sort.key);
      // Missing values stay last whatever the direction.
      const primary =
        isMissing(av) || isMissing(bv)
          ? compareValues(av, bv)
          : compareValues(av, bv) * factor;
      if (primary !== 0) return primary;
      if (tieBreak !== undefined && tieBreak !== sort.key) {
        const secondary = compareValues(
          valueOf(a.row, tieBreak),
          valueOf(b.row, tieBreak)
        );
        if (secondary !== 0) return secondary;
      }
      return a.index - b.index;
    })
    .map(({ row }) => row);
}

/** Clicking a header: a new column starts at its default, the same one flips. */
export function nextSort<K extends string>(
  current: SortState<K>,
  key: K,
  defaultDirection: SortDirection
): SortState<K> {
  if (current.key !== key) return { key, direction: defaultDirection };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

export interface PageSlice<T> {
  rows: T[];
  /** 1-based, clamped to the available pages. */
  page: number;
  pageCount: number;
  /** 1-based index of the first row shown, 0 when there are none. */
  from: number;
  /** 1-based index of the last row shown. */
  to: number;
  total: number;
}

export function paginate<T>(
  rows: readonly T[],
  page: number,
  pageSize: number
): PageSlice<T> {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.trunc(page)), pageCount);
  const start = (current - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);
  return {
    rows: slice,
    page: current,
    pageCount,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
    total,
  };
}

/**
 * Page buttons to show: always the first and last page, the current one and
 * its neighbours, with 'gap' where pages are skipped. A gap that would hide a
 * single page shows that page instead.
 */
export function pageItems(page: number, pageCount: number): (number | 'gap')[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = Array.from(wanted)
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);
  const items: (number | 'gap')[] = [];
  for (const value of pages) {
    const previous = items[items.length - 1];
    if (typeof previous === 'number' && value - previous === 2)
      items.push(previous + 1);
    else if (typeof previous === 'number' && value - previous > 2)
      items.push('gap');
    items.push(value);
  }
  return items;
}
