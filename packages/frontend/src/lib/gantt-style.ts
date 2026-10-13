/** Static class names so Tailwind can see them (one per `--color-series-N`). */
export const SERIES_BG = [
  'bg-series-1',
  'bg-series-2',
  'bg-series-3',
  'bg-series-4',
  'bg-series-5',
  'bg-series-6',
] as const;

/** Hatched fill for bars without run history. */
export const HATCH = {
  backgroundImage:
    'repeating-linear-gradient(45deg, transparent 0, transparent 3px, var(--color-muted-foreground) 3px, var(--color-muted-foreground) 4px)',
} as const;
