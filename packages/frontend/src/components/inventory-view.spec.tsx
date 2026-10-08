import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ArtifactRecord, ScheduleRecord } from '@rayfin-app/shared';

import { InventoryView } from '@/components/inventory-view.component';

const WS = '4c8efb42-7d2a-4a87-b1b1-e7e98bea053d';
const ITEM = '5a0ffa3d-80b9-49ce-acd2-2c9302cce6b8';

const artifacts = [
  { id: 'a1', displayName: 'Sales load', itemType: 'Notebook', workspaceId: WS, itemId: ITEM, workspaceName: 'Finance', capacityId: 'c1', capacityName: 'Prod', scheduleCount: 1 },
  { id: 'a2', displayName: 'Ops refresh', itemType: 'DataPipeline', workspaceName: 'Ops', capacityId: 'c1', capacityName: 'Prod', scheduleCount: 1 },
  { id: 'a3', displayName: 'Sandbox run', itemType: 'Notebook', workspaceName: 'Lab', capacityId: 'c2', capacityName: 'Dev', scheduleCount: 1 },
] as ArtifactRecord[];

const renderView = () =>
  render(
    <InventoryView
      status="ready"
      artifacts={artifacts}
      schedulesByArtifact={new Map<string, ScheduleRecord[]>()}
    />
  );

const count = () => screen.getByText(/of 3 artifacts/);
const filters = () => within(screen.getByRole('search', { name: 'Filter artifacts' }));
const pick = (menu: RegExp, option: RegExp) => {
  fireEvent.click(filters().getByRole('button', { name: menu }));
  fireEvent.click(screen.getByRole('option', { name: option }));
};

describe('InventoryView filters', () => {
  it('narrows by capacity, shows a removable chip and narrows workspaces', () => {
    renderView();
    expect(count()).toHaveTextContent('3 of 3 artifacts');
    pick(/^Capacity/, /^Prod/);
    expect(count()).toHaveTextContent('2 of 3 artifacts');

    const chips = within(screen.getByRole('group', { name: 'Active filters' }));
    expect(chips.getByText('Prod')).toBeInTheDocument();

    fireEvent.click(filters().getByRole('button', { name: /^Workspace/ }));
    expect(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['All workspaces2', 'Finance1', 'Ops1']);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

    fireEvent.click(chips.getByRole('button', { name: 'Remove capacity filter' }));
    expect(count()).toHaveTextContent('3 of 3 artifacts');
    expect(screen.queryByRole('group', { name: 'Active filters' })).toBeNull();
  });

  it('clears every filter at once', () => {
    renderView();
    pick(/^Item type/, /^Notebook/);
    fireEvent.change(screen.getByLabelText('Search artifacts'), {
      target: { value: 'sales' },
    });
    expect(count()).toHaveTextContent('1 of 3 artifacts');
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(count()).toHaveTextContent('3 of 3 artifacts');
  });

  it('opens the schedule detail for the clicked row and closes it again', () => {
    renderView();
    const row = screen.getByRole('button', { name: 'Ops refresh', pressed: false });
    fireEvent.click(row);
    expect(
      screen.getByRole('region', { name: 'Schedule detail' })
    ).toHaveTextContent('Ops refresh');
    fireEvent.click(screen.getByRole('button', { name: 'Ops refresh', pressed: true }));
    expect(screen.queryByRole('region', { name: 'Schedule detail' })).toBeNull();
  });

  it('links the selected artifact and its workspace to the Fabric portal', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Sales load', pressed: false }));
    expect(
      screen.getByRole('link', { name: 'Open Sales load in Fabric (new tab)' })
    ).toHaveAttribute(
      'href',
      `https://app.fabric.microsoft.com/groups/${WS}/synapsenotebooks/${ITEM}`
    );
    const workspace = screen.getByRole('link', {
      name: 'Open workspace Finance in Fabric (new tab)',
    });
    expect(workspace).toHaveAttribute(
      'href',
      `https://app.fabric.microsoft.com/groups/${WS}/list`
    );
    expect(workspace).toHaveAttribute('target', '_blank');
    expect(workspace).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows no portal links without a workspace id', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Ops refresh', pressed: false }));
    expect(screen.queryByRole('link', { name: /in Fabric/ })).toBeNull();
  });
});
