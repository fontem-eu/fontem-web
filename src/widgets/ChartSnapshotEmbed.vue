<script setup>
/**
 * Registry widget for `chart_snapshot`. Re-renders a saved generic
 * chart from its serialised { chart, props, title } config via the
 * shared ChartSpec renderer.
 */
import { computed } from 'vue'
import ChartSpec from '../components/charts/ChartSpec.vue'

const props = defineProps({
  config: { type: Object, default: () => ({}) },
})

const chart = computed(() => props.config.chart || '')
const chartProps = computed(() => props.config.props || {})

function storeState() {
  return { chart: chart.value, props: chartProps.value, title: props.config.title }
}
defineExpose({ storeState, widgetType: 'chart_snapshot' })
</script>

<template>
  <div class="chart-snapshot-embed" data-testid="widget-chart-snapshot">
    <div v-if="config.title" class="chart-snapshot-embed__title">{{ config.title }}</div>
    <ChartSpec :chart="chart" :chart-props="chartProps" />
  </div>
</template>

<style scoped>
.chart-snapshot-embed {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.75rem;
}
.chart-snapshot-embed__title {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text);
}
</style>
