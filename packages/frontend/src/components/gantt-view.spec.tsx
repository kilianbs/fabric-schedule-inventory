import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type {
  ArtifactRecord,
  JobRunRecord,
  ScheduleRecord,
} from '@rayfin-app/shared';

import { GanttView } from '@/components/gantt-view.component';

const artifacts = [
  { id: 'a1', displayName: 'Sales load', workspaceId: 'w1', workspaceName: 'Finance', capacityId: 'c1', capacityName: 'Prod' },
  { id: 'a2', displayName: 'Ops refresh', workspaceId: 'w2', workspaceName: 'Ops', capacityId: 'c1', capacityName: 'Prod' },
  { id: 'a3', displayName: 'Adhoc model', workspaceId: 'w2', workspaceName: 'Ops' },
] as ArtifactRecord[];

const daily = (id: string, artifactRowId: string, time: string, tz = 'UTC') =>
  ({
    id,
    artifactRowId,
    enabled: true,
    configType: 'Daily',
    startDateTime: '2026-01-01T00:00:00',
    localTimeZoneId: tz,
    timesJson: JSON.stringify([time]),
  }) as ScheduleRecord;

const schedules = new Map<string, ScheduleRecord[]>([
  ['a1', [daily('s1', 'a1', '08:00')]],
  ['a2', [daily('s2', 'a2', '08:00', 'W. Europe Standard Time')]],
  ['a3', [daily('s3', 'a3', '12:00')]],
]);

const runs = [
  ['2026-10-01T08:00:00', 600],
  ['2026-10-02T08:00:00', 1200],
  ['2026-10-03T08:00:00', 1800],
].map(
  ([startTimeUtc, durationSeconds]) =>
    ({
      id: String(startTimeUtc),
      artifactRowId: 'a1',
      status: 'Completed',
      startTimeUtc,
      durationSeconds,
    }) as JobRunRecord
);

const renderGantt = (overrides: Partial<Parameters<typeof GanttView>[0]> = {}) =>
  render(
    <GanttView
      status="ready"
      artifacts={artifacts}
      schedulesByArtifact={schedules}
      runs={runs}
      {...overrides}
    />
  );

describe('GanttView', () => {
  it('groups rows by capacity with artifact count and peak', () => {
    renderGantt();
    expect(
      screen.getByRole('button', { name: /Prod.*2 artifacts · peak 2 at 08:00/ })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No capacity/ })).toBeInTheDocument();
    expect(screen.getByText('Sales load')).toBeInTheDocument();
  });

  it('updates the average duration when N changes', () => {
    renderGantt();
    expect(screen.getByText(/avg 20 min · last 3 runs/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Average of last N runs'), {
      target: { value: '1' },
    });
    expect(screen.getByText(/avg 30 min · last 1 run( |$)/)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Sales load: 08:00, avg 30 min over 1 run$/)
    ).toBeInTheDocument();
  });

  it('regroups by workspace', () => {
    renderGantt();
    fireEvent.click(screen.getByRole('button', { name: 'workspace' }));
    expect(screen.getByRole('button', { name: /Finance/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ops.*2 artifacts/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /No capacity/ })).toBeNull();
  });

  it('collapses a group from its header', () => {
    renderGantt();
    const header = screen.getByRole('button', { name: /Prod/ });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Sales load')).toBeNull();
  });

  it('warns about mixed time zones', () => {
    renderGantt();
    const notice = screen.getByText(/2 time zones/).closest('[role="status"]');
    expect(notice).toHaveClass('bg-warning', 'text-warning-foreground');
  });

  it('suggests a sync when there are no runs yet', () => {
    renderGantt({ runs: [] });
    expect(screen.getByText(/No run history yet/)).toBeInTheDocument();
    expect(screen.getAllByText('no run history').length).toBeGreaterThan(0);
  });

  it('labels capacities by id and explains why when names are unavailable', () => {
    renderGantt({
      artifacts: [
        { ...artifacts[0], capacityId: 'abcdef0123456789', capacityName: undefined },
      ] as ArtifactRecord[],
    });
    expect(
      screen.getByRole('button', { name: /Capacity abcdef01 name unavailable/ })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Capacity names are unavailable for 1 capacity.*Admin or Contributor/)
    ).toBeInTheDocument();
  });

  describe('filters', () => {
    const openFilter = (name: RegExp) =>
      fireEvent.click(screen.getByRole('button', { name }));

    it('narrows rows, counts and peak by capacity, and clear restores', () => {
      renderGantt();
      expect(screen.getByText('3 of 3 artifacts')).toBeInTheDocument();
      openFilter(/^Capacity/);
      fireEvent.click(screen.getByRole('checkbox', { name: /Prod/ }));
      expect(screen.getByText('2 of 3 artifacts')).toBeInTheDocument();
      expect(screen.queryByText('Adhoc model')).toBeNull();
      expect(screen.queryByRole('button', { name: /No capacity/ })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
      expect(screen.getByText('3 of 3 artifacts')).toBeInTheDocument();
      expect(screen.getByText('Adhoc model')).toBeInTheDocument();
    });

    it('filters by workspace and recomputes the peak', () => {
      renderGantt();
      openFilter(/^Workspace/);
      fireEvent.click(screen.getByRole('checkbox', { name: /Finance/ }));
      expect(screen.getByText('1 of 3 artifacts')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Prod.*1 artifact · peak 1 at 08:00/ })
      ).toBeInTheDocument();
      expect(screen.queryByText('Ops refresh')).toBeNull();
    });

    it('shows removable chips for active filters', () => {
      renderGantt();
      openFilter(/^Capacity/);
      fireEvent.click(screen.getByRole('checkbox', { name: /Prod/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove filter Prod' }));
      expect(screen.getByText('3 of 3 artifacts')).toBeInTheDocument();
    });

    it('shows a clear action when filters leave nothing to plot', () => {
      renderGantt();
      openFilter(/^Workspace/);
      fireEvent.click(screen.getByRole('checkbox', { name: /Finance/ }));
      openFilter(/^Capacity/);
      fireEvent.click(screen.getByRole('checkbox', { name: /No capacity/ }));
      expect(screen.getByText('No artifacts match the filters')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
      expect(screen.getByText('Sales load')).toBeInTheDocument();
    });

    it('is keyboard accessible: aria-expanded, Escape closes and refocuses', () => {
      renderGantt();
      const trigger = screen.getByRole('button', { name: /^Capacity/ });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      fireEvent.keyDown(screen.getByRole('checkbox', { name: /Prod/ }), {
        key: 'Escape',
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveFocus();
    });
  });

  it('shows an empty state without scheduled artifacts', () => {
    renderGantt({ artifacts: [], schedulesByArtifact: new Map() });
    expect(screen.getByText('Nothing to plot for this day')).toBeInTheDocument();
  });
});
