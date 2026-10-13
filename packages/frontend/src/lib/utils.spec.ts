import { describe, expect, it } from 'vitest';

import { cn, formatRelativeTime } from '@/lib/utils';

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

describe('cn', () => {
  it('keeps font-size tokens and text colours side by side', () => {
    expect(cn('bg-primary text-primary-foreground text-300')).toBe(
      'bg-primary text-primary-foreground text-300'
    );
    expect(cn('text-300 font-medium', 'text-primary')).toBe(
      'text-300 font-medium text-primary'
    );
  });

  it('still resolves conflicts within each group', () => {
    expect(cn('text-200', 'text-300')).toBe('text-300');
    expect(cn('text-foreground', 'text-primary')).toBe('text-primary');
  });
});
