//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// The app shell loads inventory through the Rayfin client on mount. In this
// smoke test there is no backend, so stub the client factory to resolve a
// minimal typed client returning empty collections.
const selectChain = {
  select: () => selectChain,
  where: () => selectChain,
  orderBy: () => selectChain,
  first: () => selectChain,
  after: () => selectChain,
  execute: async () => [],
  executePaginated: async () => ({
    items: [],
    hasNextPage: false,
    endCursor: undefined,
  }),
};

vi.mock('@/lib/rayfin-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rayfin-client')>();
  return {
    ...actual,
    getRayfinClient: async () => ({
      data: {
        Artifact: selectChain,
        Schedule: selectChain,
        SyncRun: selectChain,
      },
      functions: {
        syncInventory: {
          invoke: async () => ({
            status: 'completed',
            workspacesScanned: 0,
            workspacesFailed: 0,
            artifactsFound: 0,
            schedulesFound: 0,
            errors: [],
          }),
        },
      },
    }),
  };
});

import App from '@/App';

describe('App', () => {
  it('renders without throwing', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it('mounts content into the document', () => {
    render(<App />);
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it('shows the empty home view when no inventory exists', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', {
        name: 'Fabric Schedule Inventory',
      })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /sync schedules now/i })
    ).toBeEnabled();
  });
});
