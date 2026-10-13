import type { KeyboardEvent } from 'react';

/**
 * Arrow/Home/End navigation between tooltip targets inside a container, so a
 * row of many bars is one tab stop. Put it on the container's onKeyDown.
 */
export function rovingKeyDown(event: KeyboardEvent<HTMLElement>) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(event.key)) return;
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[data-tip]')
  );
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : Math.min(items.length - 1, Math.max(0, index + (event.key === 'ArrowRight' ? 1 : -1)));
  event.preventDefault();
  items[next]?.focus();
}
