<script setup>
import { computed, defineExpose } from 'vue'
import ProfilePanel from '../components/ProfilePanel.vue'

const props = defineProps({
  config: {
    type: Object,
    default: () => ({}),
  },
})

const entityId = computed(() => props.config.entityId || '')

function storeState() {
  return { entityId: entityId.value }
}

defineExpose({ storeState, widgetType: 'entity_profile' })
</script>

<template>
  <div class="widget-entity-profile" data-testid="widget-entity-profile">
    <ProfilePanel v-if="entityId" :symbol="entityId" />
    <p v-else style="color: var(--muted); font-size: 0.75rem">{{ $t('app.no_entity_configured') }}</p>
  </div>
</template>

<style scoped>
.widget-entity-profile {
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}
</style>
