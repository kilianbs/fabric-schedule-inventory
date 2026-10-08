import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn, formatNumber } from '@/lib/utils';

const FOCUS =
  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';
/** Options above this count get a search box. */
const SEARCH_THRESHOLD = 8;

export interface FilterMenuOption {
  value: string;
  label: string;
  count: number;
  /** Optional leading visual (e.g. the Fabric item icon); decorative. */
  icon?: ReactNode;
}

export interface FilterMenuProps {
  label: string;
  /** Text of the "everything" entry, e.g. "All capacities". */
  allLabel: string;
  icon: LucideIcon;
  /** Selected option value, or '' for all. */
  value: string;
  options: readonly FilterMenuOption[];
  onChange: (value: string) => void;
}

/**
 * Single-select filter: a trigger that shows the current choice and a listbox
 * popover with an "All" entry, per-option counts and, for long lists, a search
 * box. Arrow keys move between options, Enter or Space picks one, Escape
 * closes and returns focus to the trigger.
 */
export function FilterMenu({
  label,
  allLabel,
  icon: Icon,
  value,
  options,
  onChange,
}: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);
  const total = options.reduce((sum, option) => sum + option.count, 0);
  const searchable = options.length > SEARCH_THRESHOLD;

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (restoreFocus) triggerRef.current?.focus();
  };

  const pick = (next: string) => {
    onChange(next);
    close(true);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // On open, focus the search box or the selected option.
  useEffect(() => {
    if (!open) return;
    if (searchRef.current) {
      searchRef.current.focus();
      return;
    }
    const items = optionElements(listRef.current);
    (items.find((item) => item.getAttribute('aria-selected') === 'true') ??
      items[0])?.focus();
  }, [open]);

  const onRootKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      close(true);
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = optionElements(event.currentTarget);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => {
      event.preventDefault();
      items[Math.min(items.length - 1, Math.max(0, next))]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') {
      if (index <= 0 && searchRef.current) {
        event.preventDefault();
        searchRef.current.focus();
      } else move(index - 1);
    } else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(items.length - 1);
    else if (event.key === 'Enter' || event.key === ' ') {
      const target = items[index];
      if (!target) return;
      event.preventDefault();
      pick(target.dataset.value ?? '');
    }
  };

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={onRootKeyDown}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (open && next && !rootRef.current?.contains(next)) close(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          'text-300 inline-flex h-800 max-w-full items-center gap-200 rounded-lg border px-300 transition-[background-color,border-color] duration-150',
          FOCUS,
          selected
            ? 'border-primary/50 bg-primary/5 hover:bg-primary/10'
            : 'border-input bg-background hover:bg-accent'
        )}
      >
        {selected?.icon ?? (
          <Icon
            aria-hidden="true"
            className={cn(
              'icon-size-200 shrink-0',
              selected ? 'text-primary' : 'text-muted-foreground'
            )}
          />
        )}
        <span className={selected ? 'text-muted-foreground' : undefined}>
          {label}
        </span>
        {selected ? (
          <span className="max-w-40 truncate font-medium text-foreground">
            {selected.label}
          </span>
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'icon-size-200 shrink-0 text-muted-foreground transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>

      {open ? (
        <div className="border-border bg-popover text-popover-foreground animate-fade-in absolute top-full left-0 z-30 mt-100 flex w-72 max-w-[calc(100vw-2rem)] flex-col rounded-xl border shadow-lg">
          {searchable ? (
            <div className="border-border relative border-b p-200">
              <Search
                aria-hidden="true"
                className="icon-size-200 pointer-events-none absolute top-1/2 left-400 -translate-y-1/2 text-muted-foreground"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    optionElements(listRef.current)[0]?.focus();
                  }
                }}
                aria-label={`Search ${label.toLowerCase()}`}
                placeholder={`Search ${label.toLowerCase()}…`}
                className={cn(
                  'border-input bg-background text-300 h-700 w-full rounded-lg border pr-300 pl-700',
                  FOCUS
                )}
              />
            </div>
          ) : null}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            onKeyDown={onListKeyDown}
            className="max-h-80 overflow-y-auto p-100"
          >
            {needle === '' ? (
              <MenuOption
                value=""
                label={allLabel}
                count={total}
                selected={value === ''}
                onPick={pick}
              />
            ) : null}
            {visible.map((option) => (
              <MenuOption
                key={option.value}
                value={option.value}
                label={option.label}
                count={option.count}
                icon={option.icon}
                selected={option.value === value}
                onPick={pick}
              />
            ))}
            {visible.length === 0 ? (
              <li className="text-200 px-300 py-200 text-muted-foreground">
                No match.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MenuOption({
  value,
  label,
  count,
  icon,
  selected,
  onPick,
}: {
  value: string;
  label: string;
  count: number;
  icon?: ReactNode;
  selected: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <li
      role="option"
      tabIndex={-1}
      aria-selected={selected}
      data-value={value}
      onClick={() => onPick(value)}
      className={cn(
        'text-300 flex cursor-pointer items-center gap-200 rounded-lg px-200 py-200 outline-none',
        'hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring focus-visible:ring-2',
        selected && 'font-medium'
      )}
    >
      <Check
        aria-hidden="true"
        className={cn(
          'icon-size-200 shrink-0 text-primary',
          selected ? 'visible' : 'invisible'
        )}
      />
      {icon}
      <span className="min-w-0 flex-1 truncate" title={label}>
        {label}
      </span>
      <span className="text-200 shrink-0 tabular-nums text-muted-foreground">
        {formatNumber(count)}
      </span>
    </li>
  );
}

function optionElements(list: HTMLElement | null): HTMLElement[] {
  return list
    ? Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'))
    : [];
}
