<script setup>
import { computed } from 'vue'
import EntityNutsMap from '../components/EntityNutsMap.vue'

const props = defineProps({
  config: { type: Object, default: () => ({}) },
})

const entityId = computed(() => props.config.entityId || '')

function storeState() {
  return {
    entityId: entityId.value,
    level:     props.config.level     ?? 0,
    metric:    props.config.metric    ?? 'contracts',
    scopeNuts: props.config.scopeNuts ?? undefined,
  }
}

defineExpose({ storeState, widgetType: 'entity_nuts_map' })
</script>

<template>
  <div class="widget-entity-nuts-map" data-testid="widget-entity-nuts-map">
    <EntityNutsMap v-if="entityId" :entity-id="entityId" />
    <p v-else style="color: var(--muted); font-size: 0.75rem">No entity configured.</p>
  </div>
</template>

<style scoped>
.widget-entity-nuts-map {
  min-height: 300px;
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}
</style>
