import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Server } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { FilterMenu } from '@/components/filter-menu.component';
import type { FilterMenuOption } from '@/components/filter-menu.component';

const options: FilterMenuOption[] = [
  { value: 'dev', label: 'Dev', count: 2 },
  { value: 'prod', label: 'Prod', count: 5 },
];

function Harness({
  initial = '',
  list = options,
  onChange,
}: {
  initial?: string;
  list?: FilterMenuOption[];
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <FilterMenu
      label="Capacity"
      allLabel="All capacities"
      icon={Server}
      value={value}
      options={list}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const trigger = () => screen.getByRole('button', { name: /Capacity/ });

describe('FilterMenu', () => {
  it('lists an "All" entry and every option with its count', () => {
    render(<Harness />);
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    const items = screen.getAllByRole('option');
    expect(items.map((item) => item.textContent)).toEqual([
      'All capacities7',
      'Dev2',
      'Prod5',
    ]);
    expect(items[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('picks an option on click, shows it on the trigger and closes', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('option', { name: /Prod/ }));
    expect(onChange).toHaveBeenCalledWith('prod');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger()).toHaveTextContent('CapacityProd');
    expect(trigger()).toHaveFocus();
  });

  it('moves with the arrow keys and picks with Enter', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    const list = screen.getByRole('listbox');
    expect(screen.getByRole('option', { name: /All capacities/ })).toHaveFocus();
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: /Dev/ })).toHaveFocus();
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('dev');
  });

  it('closes on Escape and returns focus to the trigger', () => {
    render(<Harness initial="prod" />);
    fireEvent.click(trigger());
    expect(screen.getByRole('option', { name: /Prod/ })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('searches long lists', () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      value: `c${index}`,
      label: `Capacity ${index}`,
      count: 1,
    }));
    render(<Harness list={many} />);
    fireEvent.click(trigger());
    const search = screen.getByRole('searchbox', { name: 'Search capacity' });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: '7' } });
    expect(
      screen.getAllByRole('option').map((item) => item.textContent)
    ).toEqual(['Capacity 71']);
  });
});
