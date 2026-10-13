export const SYNC_STEPS = [
  { id: 'connect', label: 'Connect', detail: 'Listing workspaces' },
  { id: 'discover', label: 'Discover', detail: 'Scanning items and schedules' },
  { id: 'persist', label: 'Persist', detail: 'Saving the inventory' },
  { id: 'reconcile', label: 'Reconcile', detail: 'Removing items without schedules' },
  { id: 'done', label: 'Done', detail: 'Inventory is up to date' },
] as const;

export type StepState = 'done' | 'active' | 'pending';

/** Index of the step currently running, or SYNC_STEPS.length when finished. */
export function stepIndexFor(
  stage: string | undefined,
  finished: boolean
): number {
  if (finished) return SYNC_STEPS.length;
  const index = SYNC_STEPS.findIndex((step) => step.id === stage);
  return index < 0 ? 0 : index;
}

export function stepState(
  index: number,
  current: number,
  started: boolean
): StepState {
  if (!started) return 'pending';
  if (index < current) return 'done';
  return index === current ? 'active' : 'pending';
}
