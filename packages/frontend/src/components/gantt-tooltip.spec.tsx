import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type {
  ArtifactRecord,
  JobRunRecord,
  ScheduleRecord,
} from '@rayfin-app/shared';

import { GanttView } from '@/components/gantt-view.component';

const artifacts = [
  { id: 'a1', displayName: 'Sales load', itemType: 'Notebook', workspaceId: 'w1', workspaceName: 'Finance', capacityId: 'c1', capacityName: 'Prod' },
  { id: 'a2', displayName: 'Ops refresh', itemType: 'DataPipeline', workspaceId: 'w2', workspaceName: 'Ops', capacityId: 'c1' },
] as ArtifactRecord[];

const daily = (id: string, artifactRowId: string, time: string) =>
  ({
    id,
    artifactRowId,
    enabled: true,
    configType: 'Daily',
    startDateTime: '2026-01-01T00:00:00',
    localTimeZoneId: 'UTC',
    timesJson: JSON.stringify([time]),
  }) as ScheduleRecord;

const schedules = new Map<string, ScheduleRecord[]>([
  ['a1', [daily('s1', 'a1', '08:00')]],
  ['a2', [daily('s2', 'a2', '08:00')]],
]);

const runs = [
  ['2026-10-01T08:00:00', 600, 'Completed'],
  ['2026-10-02T08:00:00', 1200, 'Completed'],
  ['2026-10-03T08:00:00', 1800, 'Failed'],
].map(
  ([startTimeUtc, durationSeconds, status]) =>
    ({
      id: String(startTimeUtc),
      artifactRowId: 'a1',
      status,
      startTimeUtc,
      durationSeconds,
    }) as JobRunRecord
);

const renderGantt = () =>
  render(
    <GanttView
      status="ready"
      artifacts={artifacts}
      schedulesByArtifact={schedules}
      runs={runs}
    />
  );

const salesBar = () => screen.getByLabelText(/^Sales load: 08:00/);

describe('Gantt bar tooltip', () => {
  it('opens on keyboard focus with the artifact details', () => {
    renderGantt();
    expect(screen.queryByRole('tooltip')).toBeNull();
    const bar = salesBar();
    fireEvent.focus(bar);
    const tip = screen.getByRole('tooltip');
    expect(bar).toHaveAttribute('aria-describedby', tip.id);
    const text = within(tip);
    expect(text.getByText('Sales load')).toBeInTheDocument();
    expect(text.getByText('Notebook')).toBeInTheDocument();
    expect(text.getByText('Finance')).toBeInTheDocument();
    expect(text.getByText('Prod')).toBeInTheDocument();
    expect(text.getByText('Daily at 08:00 (UTC)')).toBeInTheDocument();
    expect(text.getByText('08:00–08:20')).toBeInTheDocument();
    expect(text.getByText('20 min · 3 of 5 runs')).toBeInTheDocument();
    expect(text.getByText('10 min / 30 min')).toBeInTheDocument();
    expect(text.getByText(/Failed · 2026-10-03 08:00 UTC/)).toBeInTheDocument();
    expect(text.getByText('Enabled')).toBeInTheDocument();
  });

  it('closes on Escape and on blur', () => {
    renderGantt();
    const bar = salesBar();
    fireEvent.focus(bar);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(bar, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(bar).not.toHaveAttribute('aria-describedby');
    fireEvent.focus(bar);
    fireEvent.blur(bar);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens on mouse hover and closes on leave', () => {
    renderGantt();
    const bar = salesBar();
    fireEvent.pointerEnter(bar, { pointerType: 'mouse', clientX: 40 });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.pointerLeave(bar, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens on touch tap and closes on an outside tap', () => {
    renderGantt();
    const bar = salesBar();
    fireEvent.click(bar);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('explains placeholder bars without run history', () => {
    renderGantt();
    fireEvent.focus(screen.getByLabelText(/^Ops refresh: 08:00/));
    const tip = within(screen.getByRole('tooltip'));
    expect(tip.getByText(/No run history/)).toBeInTheDocument();
    expect(tip.getByText('none recorded')).toBeInTheDocument();
    expect(tip.getByText(/Capacity c1 \(name unavailable\)/)).toBeInTheDocument();
  });

  it('moves between bars of a row with the arrow keys', () => {
    const twice = new Map(schedules);
    twice.set('a1', [
      { ...daily('s1', 'a1', '08:00'), timesJson: '["08:00","12:00"]' },
    ]);
    render(
      <GanttView
        status="ready"
        artifacts={artifacts}
        schedulesByArtifact={twice}
        runs={runs}
      />
    );
    const [first, second] = screen.getAllByLabelText(/^Sales load: /);
    expect(first).toHaveAttribute('tabindex', '0');
    expect(second).toHaveAttribute('tabindex', '-1');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: 'Home' });
    expect(first).toHaveFocus();
  });
});

describe('Gantt load strip tooltip', () => {
  it('lists the concurrent artifacts for a time window', () => {
    renderGantt();
    const cell = screen.getByLabelText('08:00 to 08:15: 2 concurrent');
    fireEvent.focus(cell);
    const tip = within(screen.getByRole('tooltip'));
    expect(tip.getByText('08:00–08:15')).toBeInTheDocument();
    expect(tip.getByText('2 concurrent')).toBeInTheDocument();
    expect(tip.getByText('Sales load')).toBeInTheDocument();
    expect(tip.getByText('Ops refresh')).toBeInTheDocument();
  });
});
