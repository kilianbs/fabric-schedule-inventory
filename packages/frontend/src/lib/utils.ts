//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The app's font-size tokens (`--text-*` in global.css). Without them
 * tailwind-merge reads `text-300` as a colour and drops whichever of
 * `text-300` / `text-primary-foreground` comes first.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        '100',
        '200',
        '300',
        '400',
        '500',
        '600',
        'hero-700',
        'hero-800',
        'hero-900',
        'hero-1000',
      ],
    },
  },
});

/**
 * Merge Tailwind CSS class names with conflict resolution.
 *
 *   cn("px-2 py-1", isActive && "bg-primary text-primary-foreground")
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(value: Date | string | undefined): string {
  if (value === undefined) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
];

/** "3 hours ago" style text; pair it with `formatTimestamp` in a title. */
export function formatRelativeTime(
  value: Date | string | undefined,
  now: Date = new Date()
): string {
  if (value === undefined) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size)
      return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, 'minute');
}

/** Group digits with the viewer's locale so large figures stay readable. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}
