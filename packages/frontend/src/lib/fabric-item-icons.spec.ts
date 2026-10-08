import { describe, expect, it } from 'vitest';

import { hasItemIcon, itemIconUrl } from '@/lib/fabric-item-icons';

// Mirrors SCHEDULABLE_ITEM_TYPES in packages/functions/src/fabric-scan.ts.
const SCHEDULABLE = [
  'Notebook',
  'DataPipeline',
  'Dataflow',
  'CopyJob',
  'Lakehouse',
  'SemanticModel',
  'SparkJobDefinition',
  'Environment',
  'MirroredDatabase',
  'Eventhouse',
  'SQLDatabase',
  'VariableLibrary',
  'WarehouseSnapshot',
];

describe('fabric item icons', () => {
  it('has a dedicated icon for every schedulable item type', () => {
    for (const type of SCHEDULABLE) expect(hasItemIcon(type)).toBe(true);
    const urls = SCHEDULABLE.map(itemIconUrl);
    expect(new Set(urls).size).toBe(SCHEDULABLE.length);
  });

  it('falls back to the generic item icon', () => {
    expect(hasItemIcon('Report')).toBe(false);
    expect(hasItemIcon(undefined)).toBe(false);
    expect(itemIconUrl('Report')).toBe(itemIconUrl(undefined));
    expect(itemIconUrl('Report')).not.toBe(itemIconUrl('Notebook'));
  });
});
