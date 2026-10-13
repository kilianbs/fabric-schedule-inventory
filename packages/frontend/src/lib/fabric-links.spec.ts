import { describe, expect, it } from 'vitest';

import { DEFAULT_PORTAL_URL, fabricLinks, portalOrigin } from '@/lib/fabric-links';

const WS = '4c8efb42-7d2a-4a87-b1b1-e7e98bea053d';
const ITEM = '5a0ffa3d-80b9-49ce-acd2-2c9302cce6b8';

describe('fabricLinks', () => {
  it('links straight to items whose portal path is known', () => {
    expect(fabricLinks({ workspaceId: WS, itemId: ITEM, itemType: 'Lakehouse' })).toEqual({
      item: `${DEFAULT_PORTAL_URL}/groups/${WS}/lakehouses/${ITEM}`,
      workspace: `${DEFAULT_PORTAL_URL}/groups/${WS}/list`,
    });
    expect(
      fabricLinks({ workspaceId: WS, itemId: ITEM, itemType: 'Notebook' }).item
    ).toBe(`${DEFAULT_PORTAL_URL}/groups/${WS}/synapsenotebooks/${ITEM}`);
  });

  it('falls back to the workspace for other item types', () => {
    expect(fabricLinks({ workspaceId: WS, itemId: ITEM, itemType: 'CopyJob' })).toEqual({
      item: null,
      workspace: `${DEFAULT_PORTAL_URL}/groups/${WS}/list`,
    });
  });

  it('uses the configured portal origin', () => {
    expect(
      fabricLinks(
        { workspaceId: WS, itemId: ITEM, itemType: 'Lakehouse' },
        'https://app.fabric.microsoft.us/'
      ).item
    ).toBe(`https://app.fabric.microsoft.us/groups/${WS}/lakehouses/${ITEM}`);
  });

  it('refuses ids that are not GUIDs', () => {
    expect(
      fabricLinks({ workspaceId: '../evil', itemId: ITEM, itemType: 'Lakehouse' })
    ).toEqual({ item: null, workspace: null });
    expect(
      fabricLinks({ workspaceId: WS, itemId: 'x?y', itemType: 'Lakehouse' }).item
    ).toBeNull();
  });
});

describe('portalOrigin', () => {
  it('only accepts https portals', () => {
    expect(portalOrigin('http://app.fabric.microsoft.com')).toBe(DEFAULT_PORTAL_URL);
    expect(portalOrigin('javascript:alert(1)')).toBe(DEFAULT_PORTAL_URL);
    expect(portalOrigin('not a url')).toBe(DEFAULT_PORTAL_URL);
    expect(portalOrigin(undefined)).toBe(DEFAULT_PORTAL_URL);
  });
});
