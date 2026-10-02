//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { Check } from 'lucide-react';

import type { StepState } from '@/lib/sync-steps';

export function StepBadge({
  index,
  state,
}: {
  readonly index: number;
  readonly state: StepState;
}) {
  const tone =
    state === 'done'
      ? 'border-primary bg-primary text-primary-foreground'
      : state === 'active'
        ? 'border-primary bg-primary/10 text-primary ring-4 ring-primary/15'
        : 'border-border bg-card text-muted-foreground';
  return (
    <span
      className={`text-200 inline-flex h-600 w-600 shrink-0 items-center justify-center rounded-full border font-semibold transition-colors ${tone}`}
    >
      {state === 'done' ? (
        <Check aria-hidden="true" className="h-300 w-300" />
      ) : (
        index + 1
      )}
    </span>
  );
}

const RING_RADIUS = 78;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ProgressRing({
  percent,
  caption,
}: {
  readonly percent: number;
  readonly caption: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className="relative mx-auto h-[200px] w-[200px]"
      role="progressbar"
      aria-label="Synchronization progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle
          cx="100"
          cy="100"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="16"
          className="stroke-muted"
        />
        <circle
          cx="100"
          cy="100"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - clamped / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-hero-900 font-semibold tabular-nums">
          {clamped}%
        </span>
        <span className="text-200 text-muted-foreground">{caption}</span>
      </div>
    </div>
  );
}
