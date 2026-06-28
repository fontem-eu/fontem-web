<script setup>
/**
 * Generic viz wrapper — the new abstraction. Given {type, data_params, ui_params}
 * it resolves the type's data endpoint, fetches PLOT-READY data, and renders it.
 * It never reads inline data, so a forged data blob in the document is inert.
 * `saveState()` returns the params (the recipe) for pocketing.
 */
import { ref, computed, watch, onMounted } from 'vue'
import ChartSpec from '../components/charts/ChartSpec.vue'
import { resolveVizEndpoint } from './viz_registry.js'

const props = defineProps({ config: { type: Object, default: () => ({}) } })

const vizType = computed(() => props.config.widget_type || props.config.type || '')
const dataParams = computed(() => props.config.data_params || {})
const uiParams = computed(() => props.config.ui_params || {})

const plot = ref(null)
const error = ref(null)
const loading = ref(true)

async function load() {
  const url = resolveVizEndpoint(vizType.value, dataParams.value)
  if (!url) { error.value = 'Unknown visualization type'; loading.value = false; return }
  loading.value = true; error.value = null
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    plot.value = await res.json()
  } catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)
watch(dataParams, load, { deep: true })

const chartProps = computed(() => ({
  data: plot.value?.bars || [],
  format: plot.value?.format,
  ...uiParams.value,
}))

function storeState() {
  return { type: vizType.value, data_params: dataParams.value, ui_params: uiParams.value }
}
defineExpose({ storeState, widgetType: vizType })
</script>

<template>
  <div class="viz-embed" data-testid="widget-viz">
    <div v-if="loading" class="viz-msg">{{ $t('app.loading') }}</div>
    <div v-else-if="error" class="viz-msg viz-error" data-testid="viz-error">{{ error }}</div>
    <template v-else-if="plot">
      <div v-if="plot.title" class="viz-title">{{ plot.title }}</div>
      <ChartSpec :chart="plot.chart" :chart-props="chartProps" />
    </template>
  </div>
</template>

<style scoped>
.viz-embed { border: 1px solid var(--border); border-radius: 4px; padding: 0.75rem; }
.viz-title { font-size: 0.85rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text); }
.viz-msg { color: var(--muted); font-size: 0.8rem; padding: 0.5rem; }
.viz-error { color: #dc2626; }
</style>
