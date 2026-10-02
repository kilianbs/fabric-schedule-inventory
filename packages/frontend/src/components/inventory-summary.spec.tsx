import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SyncRunRecord } from '@rayfin-app/shared';

import { InventorySummary } from '@/components/inventory-summary.component';
import type { InventoryTotals } from '@/lib/inventory-totals';

const baseTotals: InventoryTotals = {
  workspaces: 4,
  artifacts: 1250,
  schedules: 3210,
  enabled: 3200,
  disabled: 10,
};

const lastRun: SyncRunRecord = {
  id: 'run-1',
  status: 'succeeded',
  startedAt: new Date('2026-10-01T10:00:00Z'),
  finishedAt: new Date('2026-10-01T10:05:00Z'),
  triggeredBy: 'test',
  workspacesScanned: 4,
  workspacesFailed: 0,
  artifactsFound: 1250,
  schedulesFound: 3210,
  errorCount: 0,
  stage: 'done',
  progressPercent: 100,
  workspacesTotal: 4,
  workspacesProcessed: 4,
};

/** Format the way the component under test does, so the test is locale-agnostic. */
const fmt = (value: number) => new Intl.NumberFormat().format(value);

function renderSummary(totals: InventoryTotals) {
  return render(<InventorySummary totals={totals} lastRun={lastRun} />);
}

/** Find the tile card whose uppercase label matches, scoped to one card. */
function tileByLabel(label: string) {
  const heading = screen.getByText(label, { exact: true });
  const tile = heading.closest('li');
  expect(tile).not.toBeNull();
  return tile as HTMLElement;
}

describe('InventorySummary', () => {
  it('renders every tile with locale-formatted figures', () => {
    renderSummary(baseTotals);
    expect(
      within(tileByLabel('Artifacts')).getByText(fmt(1250))
    ).toBeTruthy();
    expect(
      within(tileByLabel('Schedules')).getByText(fmt(3210))
    ).toBeTruthy();
    expect(within(tileByLabel('Disabled')).getByText(fmt(10))).toBeTruthy();
    expect(
      within(tileByLabel('Workspaces')).getByText(fmt(4))
    ).toBeTruthy();
  });

  it('flags the disabled tile in the danger tone only when disabled schedules exist', () => {
    const { unmount } = renderSummary(baseTotals);
    const dangerTile = tileByLabel('Disabled');
    // The value inherits the destructive tone when the count is positive.
    expect(
      within(dangerTile)
        .getByText(fmt(10))
        .className.includes('text-destructive')
    ).toBe(true);
    unmount();

    renderSummary({ ...baseTotals, disabled: 0, enabled: 3210 });
    const calmTile = tileByLabel('Disabled');
    expect(calmTile.textContent).toContain('all schedules active');
    expect(
      within(calmTile)
        .getByText(fmt(0))
        .className.includes('text-destructive')
    ).toBe(false);
  });
});
