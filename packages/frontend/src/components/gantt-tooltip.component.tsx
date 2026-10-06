import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { HTMLAttributes, PointerEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

/** Gap between the anchor and the bubble, and the minimum viewport margin. */
const GAP = 8;

interface Anchor {
  x: number;
  top: number;
  bottom: number;
}

export interface TooltipTargetProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Tooltip body; only rendered while open. */
  tip: ReactNode;
  children?: ReactNode;
}

/**
 * A focusable element with a custom tooltip. Opens on mouse hover, keyboard
 * focus and touch tap; closes on Escape, blur, mouse leave and outside tap.
 * The bubble is portaled to <body> with fixed positioning, so scrolling or
 * overflow-hidden ancestors never clip it, and it flips below the target when
 * there is no room above.
 */
export function TooltipTarget({
  tip,
  children,
  className,
  tabIndex = 0,
  ...rest
}: TooltipTargetProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const open = anchor !== null;

  const openAt = (x?: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({
      x: x ?? rect.left + rect.width / 2,
      top: rect.top,
      bottom: rect.bottom,
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setAnchor(null);
    };
    const onOutside = (event: globalThis.PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setAnchor(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside);
    };
  }, [open]);

  return (
    <div
      {...rest}
      ref={ref}
      tabIndex={tabIndex}
      data-tip=""
      aria-describedby={open ? id : undefined}
      className={className}
      onPointerEnter={(event: PointerEvent) => {
        if (event.pointerType === 'mouse') openAt(event.clientX);
      }}
      onPointerMove={(event: PointerEvent) => {
        if (event.pointerType === 'mouse' && open) {
          const x = event.clientX;
          setAnchor((current) => (current ? { ...current, x } : current));
        }
      }}
      onPointerLeave={(event: PointerEvent) => {
        if (
          event.pointerType === 'mouse' &&
          document.activeElement !== ref.current
        )
          setAnchor(null);
      }}
      onFocus={() => openAt()}
      onBlur={() => setAnchor(null)}
      onClick={(event) => {
        // Touch: tapping opens; outside tap, blur or Escape closes.
        if (!open) openAt(event.clientX || undefined);
      }}
    >
      {children}
      {anchor
        ? createPortal(
            <TooltipBubble id={id} anchor={anchor}>
              {tip}
            </TooltipBubble>,
            document.body
          )
        : null}
    </div>
  );
}

function TooltipBubble({
  id,
  anchor,
  children,
}: {
  id: string;
  anchor: Anchor;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Positioned imperatively after measuring, so there is no flash at 0,0.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const maxLeft = Math.max(GAP, window.innerWidth - width - GAP);
    const left = Math.min(Math.max(GAP, anchor.x - width / 2), maxLeft);
    const above = anchor.top - height - GAP;
    const top = above >= GAP ? above : anchor.bottom + GAP;
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    el.style.visibility = 'visible';
  }, [anchor]);

  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      style={{ visibility: 'hidden' }}
      className={cn(
        'border-border bg-popover text-popover-foreground pointer-events-none fixed top-0 left-0 z-50 w-max max-w-xs rounded-xl border px-300 py-200 shadow-lg'
      )}
    >
      {children}
    </div>
  );
}
