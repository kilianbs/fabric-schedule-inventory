import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ScheduleRecord } from '@rayfin-app/shared';

import { ScheduleDetail } from '@/components/schedule-detail.component';

const OWNER = '7d1c2a40-93f1-4b1e-9a5e-0c2f6e8d1a77';
const SCHEDULE = 'b8e5c3f2-1a4d-4c6b-8e2f-5d9a7c3b1e60';

const schedule = {
  id: 's1',
  scheduleFabricId: SCHEDULE,
  jobType: 'RunNotebook',
  enabled: true,
  configType: 'Daily',
  localTimeZoneId: 'UTC',
  timesJson: JSON.stringify(['08:00']),
  ownerType: 'User',
  ownerId: OWNER,
} as ScheduleRecord;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ScheduleDetail', () => {
  it('shows the full user and schedule IDs', () => {
    render(<ScheduleDetail schedules={[schedule]} />);
    expect(screen.getByText('User ID')).toBeInTheDocument();
    expect(screen.getByText(OWNER)).toBeInTheDocument();
    expect(screen.getByText(SCHEDULE)).toBeInTheDocument();
  });

  it('copies an ID and confirms it briefly', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.useFakeTimers();
    render(<ScheduleDetail schedules={[schedule]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy schedule ID' }));
    });
    expect(writeText).toHaveBeenCalledWith(SCHEDULE);
    expect(screen.getByRole('button', { name: 'Copied schedule ID' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1600));
    expect(screen.getByRole('button', { name: 'Copy schedule ID' })).toBeInTheDocument();
  });

  it('keeps working when the clipboard is blocked', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    render(<ScheduleDetail schedules={[schedule]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy user ID' }));
    });
    expect(screen.getByRole('button', { name: 'Copy user ID' })).toBeInTheDocument();
  });
});
