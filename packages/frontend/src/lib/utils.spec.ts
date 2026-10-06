import { describe, expect, it } from 'vitest';

import { formatRelativeTime } from '@/lib/utils';

describe('formatRelativeTime', () => {
  const now = new Date('2026-10-06T12:00:00Z');
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  it('picks the largest fitting unit', () => {
    expect(formatRelativeTime(new Date('2026-10-06T09:00:00Z'), now)).toBe(
      rtf.format(-3, 'hour')
    );
    expect(formatRelativeTime(new Date('2026-10-04T12:00:00Z'), now)).toBe(
      rtf.format(-2, 'day')
    );
    expect(formatRelativeTime(new Date('2026-10-06T11:59:40Z'), now)).toBe(
      rtf.format(0, 'minute')
    );
  });

  it('handles missing and invalid values', () => {
    expect(formatRelativeTime(undefined, now)).toBe('—');
    expect(formatRelativeTime('nope', now)).toBe('unknown');
  });
});
