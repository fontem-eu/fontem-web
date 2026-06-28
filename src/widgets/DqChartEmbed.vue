<script setup>
/**
 * DqChartEmbed — renders a data-quality chart from a recipe { data_params:{chart_key} }.
 * Looks the key up in DQ_CHARTS, refetches its `source` from the Fontem
 * data-quality API, runs the registered `build`, and renders via ChartSpec.
 * It never reads inline data, so a forged blob in the document is inert.
 */
import { ref, computed, watch, onMounted } from 'vue'
import ChartSpec from '../components/charts/ChartSpec.vue'
import { dqChart } from './dqCharts.js'

const props = defineProps({ config: { type: Object, default: () => ({}) } })

const dataParams = computed(() => props.config.data_params || {})
const chartKey = computed(() => dataParams.value.chart_key || '')
const spec = computed(() => dqChart(chartKey.value))

const payload = ref(null)
const error = ref(null)
const loading = ref(true)

async function load() {
  const s = spec.value
  if (!s) { error.value = 'Unknown chart'; loading.value = false; return }
  loading.value = true; error.value = null
  try {
    const res = await fetch(`/api/data-quality/${s.source}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    payload.value = await res.json()
  } catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)
watch(chartKey, load)

const chartProps = computed(() => (spec.value && payload.value != null ? spec.value.build(payload.value, dataParams.value) : {}))

function storeState() {
  return { type: 'dq_chart', data_params: { chart_key: chartKey.value }, ui_params: {} }
}
defineExpose({ storeState })
</script>

<template>
  <div class="viz-embed" data-testid="widget-viz">
    <div v-if="loading" class="viz-msg">{{ $t('app.loading') }}</div>
    <div v-else-if="error" class="viz-msg viz-error" data-testid="viz-error">{{ error }}</div>
    <ChartSpec v-else :chart="spec.chart" :chart-props="chartProps" />
  </div>
</template>

<style scoped>
.viz-embed { border: 1px solid var(--border); border-radius: 4px; padding: 0.75rem; }
.viz-msg { color: var(--muted); font-size: 0.8rem; padding: 0.5rem; }
.viz-error { color: #dc2626; }
</style>
