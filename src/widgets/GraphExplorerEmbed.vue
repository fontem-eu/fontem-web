<script setup>
import { computed, defineExpose } from 'vue'
import GraphExplorer from '../components/GraphExplorer.vue'

const props = defineProps({
  config: {
    type: Object,
    default: () => ({}),
  },
})

const entityId = computed(() => props.config.entityId || '')

function storeState() {
  return {
    entityId: entityId.value,
    depth: props.config.depth ?? 1,
    typeFilters: props.config.typeFilters ?? {},
    timeRange: props.config.timeRange ?? '12m',
    summaryEdges: props.config.summaryEdges ?? true,
  }
}

defineExpose({ storeState, widgetType: 'graph_explorer' })
</script>

<template>
  <div class="widget-graph-explorer" data-testid="widget-graph-explorer">
    <GraphExplorer v-if="entityId" :entity-id="entityId" />
    <p v-else style="color: var(--muted); font-size: 0.75rem">{{ $t('app.no_entity_configured') }}</p>
  </div>
</template>

<style scoped>
.widget-graph-explorer {
  min-height: 300px;
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}
</style>
