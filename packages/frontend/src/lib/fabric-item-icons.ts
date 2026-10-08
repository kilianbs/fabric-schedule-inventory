// Fabric item icons from @fabric-msft/svg-icons (MIT, Microsoft), the source
// catalogued by https://github.com/FabricTools/fabric-icons. Static imports so
// Vite bundles only these files out of the ~5,000 in the package.
import copyJob from '@fabric-msft/svg-icons/copy_job_20_item.svg';
import dataWarehouse from '@fabric-msft/svg-icons/data_warehouse_20_item.svg';
import dataflowGen2 from '@fabric-msft/svg-icons/dataflow_gen2_20_item.svg';
import environment from '@fabric-msft/svg-icons/environment_20_item.svg';
import eventHouse from '@fabric-msft/svg-icons/event_house_20_item.svg';
import genericItem from '@fabric-msft/svg-icons/generic_placeholder_20_item.svg';
import lakehouse from '@fabric-msft/svg-icons/lakehouse_20_item.svg';
import mirroredDatabase from '@fabric-msft/svg-icons/mirrored_generic_database_20_item.svg';
import notebook from '@fabric-msft/svg-icons/notebook_20_item.svg';
import pipeline from '@fabric-msft/svg-icons/pipeline_20_item.svg';
import semanticModel from '@fabric-msft/svg-icons/semantic_model_20_item.svg';
import sparkJobDefinition from '@fabric-msft/svg-icons/spark_job_direction_20_item.svg';
import sqlDatabase from '@fabric-msft/svg-icons/sql_database_20_item.svg';
import variableLibrary from '@fabric-msft/svg-icons/variable_library_20_item.svg';

/**
 * Icon per Fabric REST item type. Keep in step with SCHEDULABLE_ITEM_TYPES in
 * `packages/functions/src/fabric-scan.ts`.
 */
const ITEM_ICONS: Readonly<Record<string, string>> = {
  Notebook: notebook,
  DataPipeline: pipeline,
  Dataflow: dataflowGen2,
  CopyJob: copyJob,
  Lakehouse: lakehouse,
  SemanticModel: semanticModel,
  SparkJobDefinition: sparkJobDefinition,
  Environment: environment,
  MirroredDatabase: mirroredDatabase,
  Eventhouse: eventHouse,
  SQLDatabase: sqlDatabase,
  VariableLibrary: variableLibrary,
  WarehouseSnapshot: dataWarehouse,
};

/** URL of the item type's icon; a generic item icon for unknown types. */
export function itemIconUrl(itemType: string | undefined): string {
  return (itemType && ITEM_ICONS[itemType]) || genericItem;
}

/** True when the item type has its own icon (not the generic fallback). */
export function hasItemIcon(itemType: string | undefined): boolean {
  return Boolean(itemType && ITEM_ICONS[itemType]);
}
