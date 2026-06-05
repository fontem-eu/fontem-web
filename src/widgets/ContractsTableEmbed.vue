<script setup>
import { computed, defineExpose } from 'vue'
import ContractsPanel from '../components/ContractsPanel.vue'

const props = defineProps({
  config: {
    type: Object,
    default: () => ({}),
  },
})

const symbol = computed(() => props.config.entityId || '')

function storeState() {
  return { entityId: symbol.value }
}

defineExpose({ storeState, widgetType: 'contracts_table' })
</script>

<template>
  <div class="widget-contracts-table" data-testid="widget-contracts-table">
    <ContractsPanel v-if="symbol" :symbol="symbol" />
    <p v-else style="color: var(--muted); font-size: 0.75rem">{{ $t('app.no_entity_configured') }}</p>
  </div>
</template>

<style scoped>
.widget-contracts-table {
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}
</style>
