import { useId } from 'react';

import { cn } from '@/lib/utils';

/**
 * Colour "⚠️"-style glyph: a rounded amber triangle with a soft top-light
 * gradient and a dark exclamation mark. Drawn inline so it looks the same on
 * every OS (native emoji fonts differ). Decorative; the text carries meaning.
 */
export function WarningEmoji({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('icon-size-300 shrink-0', className)}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-warning-emphasis)" stopOpacity="0.75" />
          <stop offset="0.45" stopColor="var(--color-warning-emphasis)" />
          <stop offset="1" stopColor="var(--color-warning-emphasis)" />
        </linearGradient>
      </defs>
      <path
        d="M10.1 3.6a2.2 2.2 0 0 1 3.8 0l8.2 14.2A2.2 2.2 0 0 1 20.2 21H3.8a2.2 2.2 0 0 1-1.9-3.2Z"
        fill={`url(#${id}-fill)`}
      />
      <path
        d="M10.1 3.6a2.2 2.2 0 0 1 3.8 0l8.2 14.2A2.2 2.2 0 0 1 20.2 21H3.8a2.2 2.2 0 0 1-1.9-3.2Z"
        fill="none"
        stroke="var(--color-warning-glyph)"
        strokeOpacity="0.18"
      />
      <rect x="10.75" y="8" width="2.5" height="7" rx="1.25" fill="var(--color-warning-glyph)" />
      <circle cx="12" cy="17.6" r="1.4" fill="var(--color-warning-glyph)" />
    </svg>
  );
}
