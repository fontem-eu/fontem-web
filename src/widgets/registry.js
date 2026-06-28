import { defineAsyncComponent } from 'vue'

const registry = {
  graph_explorer: () => import('./GraphExplorerEmbed.vue'),
  contracts_table: () => import('./ContractsTableEmbed.vue'),
  entity_profile: () => import('./EntityProfileEmbed.vue'),
  entity_nuts_map: () => import('./EntityNutsMapEmbed.vue'),
  atlas_map: () => import('./AtlasMapEmbed.vue'),
  chart_snapshot: () => import('./ChartSnapshotEmbed.vue'),
  company_bidder_breakdown: () => import('./VizEmbed.vue'),
}

export function resolveWidget(type) {
  const loader = registry[type]
  return loader ? defineAsyncComponent(loader) : null
}

export function getWidgetTypes() {
  return Object.keys(registry).map((key) => ({
    key,
    label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }))
}
