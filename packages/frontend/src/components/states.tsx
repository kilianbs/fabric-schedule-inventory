import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

/**
 * The states every data-backed list has to handle, in one place.
 *
 * These exist because "it works" and "it works when the list is empty, the network is
 * down, or the user has no rows yet" are different bars, and the second one is what
 * ships. Each has a deliberate shape: empty is inviting, error is actionable, loading
 * holds layout instead of collapsing it.
 *
 * Copied from the crud-ui skill kit.
 */

export function LoadingState({ rows = 3 }: { readonly rows?: number }) {
  return (
    <div
      className="flex flex-col gap-200"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="bg-muted h-800 animate-pulse rounded-xl"
        />
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  readonly title: string;
  /** One line on what this list is for, or how to add the first item. */
  readonly hint?: string;
  readonly action?: ReactNode;
}

export function EmptyState({ title, hint, action }: EmptyStateProps) {
  return (
    <div className="border-border bg-card animate-fade-up flex flex-col items-center gap-200 rounded-2xl border border-dashed px-600 py-800 text-center">
      <p className="text-400 font-semibold">{title}</p>
      {hint ? <p className="text-300 max-w-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-200">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  readonly message: string;
  readonly onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/10 text-foreground animate-fade-up flex items-start gap-300 rounded-xl border px-400 py-300"
    >
      <TriangleAlert
        aria-hidden="true"
        className="text-destructive icon-size-200 mt-100 shrink-0"
      />
      <div className="text-300 min-w-0 flex-1">
        <p className="font-semibold">That didn't work</p>
        <p className="mt-100 text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-200 focus-visible:ring-ring shrink-0 rounded-md px-200 py-100 font-medium underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
