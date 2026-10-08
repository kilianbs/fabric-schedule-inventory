/** Public cloud portal; used when the deployment config does not carry one. */
export const DEFAULT_PORTAL_URL = 'https://app.fabric.microsoft.com';

/**
 * Portal path segment per Fabric REST item type, for types whose item page
 * URL is `/groups/{workspaceId}/{segment}/{itemId}`. Only `lakehouses` is
 * spelled out in Microsoft's docs; the others follow the portal's own URLs.
 * Types not listed here link to their workspace instead.
 */
const ITEM_SEGMENTS: Readonly<Record<string, string>> = {
  Notebook: 'synapsenotebooks',
  DataPipeline: 'pipelines',
  Lakehouse: 'lakehouses',
  SemanticModel: 'datasets',
  SparkJobDefinition: 'sparkjobdefinitions',
  Eventhouse: 'eventhouses',
};

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FabricLinks {
  /** The item's own page, or null when its URL shape is not known. */
  item: string | null;
  /** The workspace's item list, or null without a valid workspace id. */
  workspace: string | null;
}

/** https origin of the configured portal, falling back to the public cloud. */
export function portalOrigin(portalUrl: string | undefined): string {
  if (portalUrl) {
    try {
      const url = new URL(portalUrl);
      if (url.protocol === 'https:') return url.origin;
    } catch {
      // Fall through to the default.
    }
  }
  return DEFAULT_PORTAL_URL;
}

/** Portal links for an artifact; ids that are not GUIDs produce no link. */
export function fabricLinks(
  artifact: { workspaceId?: string; itemId?: string; itemType?: string },
  portalUrl?: string
): FabricLinks {
  const origin = portalOrigin(portalUrl);
  const workspaceId = artifact.workspaceId;
  if (!workspaceId || !GUID.test(workspaceId)) return { item: null, workspace: null };
  const workspace = `${origin}/groups/${workspaceId}/list`;
  const segment = artifact.itemType ? ITEM_SEGMENTS[artifact.itemType] : undefined;
  const item =
    segment && artifact.itemId && GUID.test(artifact.itemId)
      ? `${origin}/groups/${workspaceId}/${segment}/${artifact.itemId}`
      : null;
  return { item, workspace };
}
