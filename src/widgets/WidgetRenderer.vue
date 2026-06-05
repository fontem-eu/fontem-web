<script setup>
import { computed } from 'vue'
import { resolveWidget } from './registry.js'

const props = defineProps({
  config: {
    type: Object,
    required: true,
  },
})

const widgetComponent = computed(() => resolveWidget(props.config.widget_type))
</script>

<template>
  <div class="widget-renderer" data-testid="widget-renderer">
    <component
      :is="widgetComponent"
      v-if="widgetComponent"
      :config="config"
    />
    <div v-else class="widget-unknown" data-testid="widget-unknown">
      <p>{{ $t('widget_renderer.unknown_widget_type') }}<code>{{ config.widget_type }}</code></p>
    </div>
  </div>
</template>

<style scoped>
.widget-renderer {
  margin: 1rem 0;
}
.widget-unknown {
  padding: 1rem;
  border: 1px dashed var(--border);
  border-radius: 4px;
  color: var(--muted);
  font-size: 0.8rem;
  text-align: center;
}
</style>
