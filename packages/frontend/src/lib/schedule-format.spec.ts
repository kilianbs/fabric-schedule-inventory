import { describe, expect, it } from 'vitest';

import {
  describeSchedule,
  formatInterval,
  formatScheduleDateTime,
} from '@/lib/schedule-format';

describe('describeSchedule', () => {
  it('summarises interval schedules', () => {
    expect(describeSchedule({ configType: 'Cron', intervalMinutes: 30 })).toBe(
      'Every 30 min'
    );
    expect(describeSchedule({ configType: 'Cron', intervalMinutes: 120 })).toBe(
      'Every 2 h'
    );
  });

  it('summarises daily and weekly schedules', () => {
    expect(
      describeSchedule({ configType: 'Daily', timesJson: '["08:00","14:00"]' })
    ).toBe('Daily at 08:00, 14:00');
    expect(
      describeSchedule({
        configType: 'Weekly',
        weekdaysJson: '["Monday","Wednesday"]',
        timesJson: '["09:00"]',
      })
    ).toBe('Weekly on Mon, Wed at 09:00');
  });

  it('summarises monthly schedules', () => {
    expect(
      describeSchedule({
        configType: 'Monthly',
        monthlyConfigJson: '{"recurrence":1,"occurrence":{"dayOfMonth":5}}',
        timesJson: '["06:00"]',
      })
    ).toBe('Monthly (every month; dayOfMonth: 5) at 06:00');
  });

  it('degrades gracefully on bad or missing JSON', () => {
    expect(describeSchedule({ configType: 'Daily', timesJson: '{oops' })).toBe(
      'Daily'
    );
    expect(describeSchedule({ configType: 'Custom' })).toBe('Custom');
    expect(describeSchedule({ configType: '' })).toBe('—');
  });
});

describe('formatInterval', () => {
  it('uses the largest whole unit', () => {
    expect(formatInterval(90)).toBe('90 min');
    expect(formatInterval(1440)).toBe('1 day');
    expect(formatInterval(2880)).toBe('2 days');
  });
});

describe('formatScheduleDateTime', () => {
  it('trims seconds without converting zones', () => {
    expect(formatScheduleDateTime('2026-10-01T08:00:00')).toBe('2026-10-01 08:00');
    expect(formatScheduleDateTime('not a date')).toBe('not a date');
    expect(formatScheduleDateTime(undefined)).toBe('—');
  });
});

