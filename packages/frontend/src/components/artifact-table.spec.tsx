import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ArtifactTable } from '@/components/artifact-table.component';
import type { ArtifactTableRow } from '@/components/artifact-table.component';

const row = (index: number, extra: Partial<ArtifactTableRow> = {}): ArtifactTableRow => ({
  id: `a${index}`,
  displayName: `Artifact ${index}`,
  itemType: 'Notebook',
  workspaceName: 'Finance',
  capacity: 'Prod',
  scheduleCount: index,
  disabledCount: 0,
  lastSyncedAt: '2026-10-01T08:00:00Z',
  ...extra,
});

const rows = Array.from({ length: 25 }, (_, index) => row(index + 1));

/** Names of the artifacts in the desktop table body, in order. */
const tableNames = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((tr) => within(tr).getAllByRole('button')[0].textContent);

const renderTable = (onSelect = vi.fn()) =>
  render(<ArtifactTable rows={rows} selectedId={null} onSelect={onSelect} />);

describe('ArtifactTable', () => {
  it('starts with the most scheduled artifacts and 20 rows per page', () => {
    renderTable();
    const names = tableNames();
    expect(names).toHaveLength(20);
    expect(names[0]).toBe('Artifact 25');
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1–20 of 25');
    expect(
      screen.getByRole('columnheader', { name: /Schedules/ })
    ).toHaveAttribute('aria-sort', 'descending');
  });

  it('sorts by a header and flips on a second click', () => {
    renderTable();
    const header = within(
      screen.getByRole('columnheader', { name: /Artifact/ })
    ).getByRole('button');
    fireEvent.click(header);
    expect(tableNames().slice(0, 3)).toEqual(['Artifact 1', 'Artifact 2', 'Artifact 3']);
    expect(
      screen.getByRole('columnheader', { name: /Artifact/ })
    ).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(header);
    expect(tableNames()[0]).toBe('Artifact 25');
  });

  it('pages forward and changes the page size', () => {
    renderTable();
    const pager = within(screen.getByRole('navigation', { name: 'Pagination' }));
    expect(pager.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    fireEvent.click(pager.getByRole('button', { name: 'Page 2' }));
    expect(pager.getByRole('button', { name: 'Page 2' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(tableNames()).toHaveLength(5);
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 21–25 of 25');
    expect(pager.getByRole('button', { name: 'Next page' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Rows per page'), {
      target: { value: '10' },
    });
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1–10 of 25');
    expect(pager.getByRole('button', { name: 'Page 3' })).toBeInTheDocument();
  });

  it('selects a row by clicking anywhere on it', () => {
    const onSelect = vi.fn();
    renderTable(onSelect);
    const tr = within(screen.getByRole('table')).getAllByRole('row')[1];
    fireEvent.click(within(tr).getAllByRole('cell')[3]);
    expect(onSelect).toHaveBeenCalledWith('a25');
  });

  it('deselects when the selected row is picked again', () => {
    const onSelect = vi.fn();
    render(<ArtifactTable rows={rows} selectedId="a25" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Artifact 25', pressed: true }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('flags disabled schedules', () => {
    render(
      <ArtifactTable
        rows={[row(1, { disabledCount: 2 })]}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    expect(
      within(screen.getByRole('table')).getByLabelText('2 disabled')
    ).toBeInTheDocument();
  });
});
