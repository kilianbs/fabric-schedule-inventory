//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useCallback, useSyncExternalStore } from 'react';

export type AppRoute = 'inventory' | 'about';

export function parseRoute(hash: string): AppRoute {
  return hash.replace(/^#\/?/, '') === 'about' ? 'about' : 'inventory';
}

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

/** Hash-based routing: static hosting has no server fallback for deep paths. */
export function useHashRoute(): [AppRoute, (route: AppRoute) => void] {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => ''
  );
  const navigate = useCallback((route: AppRoute) => {
    window.location.hash = route === 'about' ? '#/about' : '#/';
  }, []);
  return [parseRoute(hash), navigate];
}
