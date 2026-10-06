import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';

import type { FilterOption } from '@/lib/gantt';
import { cn, formatNumber } from '@/lib/utils';

const FOCUS =
  'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none';
/** Options above this count get a search box. */
const SEARCH_THRESHOLD = 8;

export interface GanttFilterProps {
  label: string;
  options: readonly FilterOption[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
}

/**
 * Multi-select popover: a trigger button plus a checkbox list. Escape closes
 * and returns focus to the trigger; clicking or tabbing outside closes it.
 */
export function GanttFilter({
  label,
  options,
  selected,
  onChange,
}: GanttFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (restoreFocus) triggerRef.current?.focus();
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

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      close(true);
    }
  };

  const toggle = (key: string) =>
    onChange(
      selected.includes(key)
        ? selected.filter((value) => value !== key)
        : [...selected, key]
    );

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (open && next && !rootRef.current?.contains(next)) close(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'border-input bg-background text-foreground text-300 hover:bg-accent h-800 flex items-center gap-200 rounded-lg border px-300',
          FOCUS,
          selected.length > 0 && 'border-primary'
        )}
      >
        {label}
        {selected.length > 0 ? (
          <span className="bg-primary text-primary-foreground text-200 rounded-full px-200 font-semibold tabular-nums">
            {selected.length}
          </span>
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'icon-size-200 text-muted-foreground transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>
      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label={`${label} filter`}
          className="border-border bg-popover text-popover-foreground absolute top-full left-0 z-30 mt-100 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-200 rounded-xl border p-200 shadow-lg"
        >
          {options.length > SEARCH_THRESHOLD ? (
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={`Search ${label.toLowerCase()}`}
              placeholder={`Search ${label.toLowerCase()}`}
              className={cn(
                'border-input bg-background text-300 h-700 rounded-lg border px-300',
                FOCUS
              )}
            />
          ) : null}
          <ul className="max-h-80 overflow-y-auto">
            {visible.map((option) => (
              <li key={option.key}>
                <label className="hover:bg-accent text-300 flex cursor-pointer items-center gap-200 rounded-lg px-200 py-100-nudge">
                  <input
                    type="checkbox"
                    checked={selected.includes(option.key)}
                    onChange={() => toggle(option.key)}
                    className={cn('icon-size-200 shrink-0', FOCUS)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.nameKnown ? null : (
                      <span className="text-200 block text-muted-foreground">
                        name unavailable
                      </span>
                    )}
                  </span>
                  <span
                    aria-label={`${option.count} artifacts`}
                    className="text-200 text-muted-foreground tabular-nums"
                  >
                    {formatNumber(option.count)}
                  </span>
                </label>
              </li>
            ))}
            {visible.length === 0 ? (
              <li className="text-200 px-200 py-200 text-muted-foreground">
                No match.
              </li>
            ) : null}
          </ul>
          <div className="border-border flex justify-end border-t pt-200">
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => onChange([])}
              className={cn(
                'text-200 rounded-md px-200 py-100 font-medium underline underline-offset-2 disabled:no-underline disabled:opacity-50',
                FOCUS
              )}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
