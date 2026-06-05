<script setup>
/**
 * Vue NodeView for the WidgetNode TipTap extension.
 * Renders the existing WidgetRenderer component inline in the editor.
 */
import { computed } from 'vue'
import { NodeViewWrapper } from '@tiptap/vue-3'
import WidgetRenderer from '../widgets/WidgetRenderer.vue'

const props = defineProps({
  node: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  deleteNode: { type: Function, required: true },
})

const config = computed(() => {
  const a = props.node.attrs
  const out = {
    widget_type: a.widget_type,
    schema_version: a.schema_version,
  }
  // Only include attrs that were actually set, so widget components
  // see clean configs rather than null-padded ones.
  if (a.entityId)   out.entityId = a.entityId
  if (a.depth)      out.depth = a.depth
  if (a.dataset)    out.dataset = a.dataset
  if (a.nuts_level !== undefined && a.nuts_level !== null) out.nuts_level = a.nuts_level
  if (a.year !== undefined && a.year !== null) out.year = a.year
  if (a.dimensions) out.dimensions = a.dimensions
  return out
})
</script>

<template>
  <NodeViewWrapper
    class="widget-node-view"
    :class="{ 'widget-node-view--selected': selected }"
    data-testid="widget-node"
  >
    <div class="widget-node-header">
      <span class="widget-node-badge">{{ config.widget_type?.replace(/_/g, ' ') }}</span>
      <button class="widget-node-delete" :title="$t('widget_node.remove_widget')" @click="deleteNode">×</button>
    </div>
    <WidgetRenderer :config="config" />
  </NodeViewWrapper>
</template>

<style scoped>
.widget-node-view {
  border: 1px solid var(--border, #ddd);
  border-radius: 6px;
  margin: 0.75rem 0;
  overflow: hidden;
  transition: border-color 0.15s;
}
.widget-node-view--selected {
  border-color: var(--accent, #2563eb);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}
.widget-node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.5rem;
  background: var(--bg, #f9fafb);
  border-bottom: 1px solid var(--border, #ddd);
  font-size: 0.7rem;
}
.widget-node-badge {
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  color: var(--muted, #999);
}
.widget-node-delete {
  border: none;
  background: none;
  color: var(--muted, #999);
  font-size: 1rem;
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
}
.widget-node-delete:hover { color: #dc2626; }
</style>
