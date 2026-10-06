import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ArtifactRecord, ScheduleRecord } from '@rayfin-app/shared';

import { AppShell } from '@/components/app-shell.component';
import { computeTotals } from '@/lib/inventory-totals';
import { parseRoute } from '@/hooks/use-hash-route';

describe('parseRoute', () => {
  it('maps hashes to routes, defaulting to inventory', () => {
    expect(parseRoute('')).toBe('inventory');
    expect(parseRoute('#/')).toBe('inventory');
    expect(parseRoute('#/about')).toBe('about');
    expect(parseRoute('#about')).toBe('about');
    expect(parseRoute('#/gantt')).toBe('gantt');
    expect(parseRoute('#/unknown')).toBe('inventory');
  });
});

describe('computeTotals', () => {
  it('counts distinct workspaces and enabled/disabled schedules', () => {
    const artifacts = [
      { id: 'a1', workspaceId: 'w1' },
      { id: 'a2', workspaceId: 'w1' },
      { id: 'a3', workspaceId: 'w2' },
    ] as ArtifactRecord[];
    const schedules = new Map<string, ScheduleRecord[]>([
      [
        'a1',
        [{ enabled: true }, { enabled: false }] as ScheduleRecord[],
      ],
      ['a3', [{ enabled: true }] as ScheduleRecord[]],
    ]);
    expect(computeTotals(artifacts, schedules)).toEqual({
      workspaces: 2,
      artifacts: 3,
      schedules: 3,
      enabled: 2,
      disabled: 1,
    });
  });
});

describe('AppShell', () => {
  const renderShell = (overrides: { onNavigate?: () => void; onSync?: () => void } = {}) =>
    render(
      <AppShell
        route="inventory"
        onNavigate={overrides.onNavigate ?? vi.fn()}
        lastRun={null}
        artifactCount={0}
        isSyncing={false}
        onSync={overrides.onSync ?? vi.fn()}
      >
        <p>content</p>
      </AppShell>
    );

  it('marks the active page and navigates on click', () => {
    const onNavigate = vi.fn();
    renderShell({ onNavigate });
    expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'About' })).not.toHaveAttribute(
      'aria-current'
    );
    fireEvent.click(screen.getByRole('link', { name: 'About' }));
    expect(onNavigate).toHaveBeenCalledWith('about');
  });

  it('links to the Gantt page', () => {
    const onNavigate = vi.fn();
    renderShell({ onNavigate });
    const link = screen.getByRole('link', { name: 'Gantt' });
    expect(link).toHaveAttribute('href', '#/gantt');
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith('gantt');
  });

  it('offers sync in the top bar and no theme toggle', () => {
    const onSync = vi.fn();
    renderShell({ onSync });
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));
    expect(onSync).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /mode/i })).toBeNull();
  });

  it('has no refresh action in the top bar', () => {
    renderShell();
    expect(screen.queryByRole('button', { name: /refresh/i })).toBeNull();
  });
});
