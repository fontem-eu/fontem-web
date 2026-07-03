<script setup>
/**
 * Renders a pocketed Data Studio pipeline: { data_params: { sources, transform },
 * ui_params: { chart, x, y } }. Re-runs the source queries (Fontem read-only
 * proxies) + the DuckDB-WASM transform in the browser, then plots. No stored data.
 */
import { ref, computed, watch, onMounted } from 'vue'
import ChartSpec from '../components/charts/ChartSpec.vue'
import StudioMap from '../components/StudioMap.vue'
import { useDuckDB } from '../composables/useDuckDB.js'
import { buildChartProps, fetchSource } from '../composables/studioPlot.js'

const props = defineProps({ config: { type: Object, default: () => ({}) } })
const dp = computed(() => props.config.data_params || {})
const up = computed(() => props.config.ui_params || {})
const { runTransform } = useDuckDB()

const result = ref(null)
const error = ref(null)
const loading = ref(true)

async function load() {
  loading.value = true; error.value = null; result.value = null
  try {
    const sources = dp.value.sources || []
    if (!sources.length) throw new Error('Pipeline has no sources')
    const inputs = []
    for (const s of sources) inputs.push(await fetchSource(s))
    const sql = (dp.value.transform || '').trim() || `SELECT * FROM "${inputs[0].name}"`
    result.value = await runTransform(inputs, sql)
  } catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)
watch(dp, load, { deep: true })

const chartProps = computed(() => buildChartProps(result.value, up.value))
function storeState() { return { type: 'pipeline', data_params: dp.value, ui_params: up.value } }
defineExpose({ storeState })
</script>

<template>
  <div class="viz-embed" data-testid="widget-viz">
    <div v-if="loading" class="viz-msg">{{ $t('app.loading') }}</div>
    <div v-else-if="error" class="viz-msg viz-error" data-testid="viz-error">{{ error }}</div>
    <StudioMap v-else-if="result && up.chart === 'atlas_map'" :rows="result.rows" :columns="result.columns" :geo-col="up.x" :value-col="up.y" :value2-col="up.y2" :bivariate="up.bivariate || 'none'" :level="up.level || 0" />
    <ChartSpec v-else-if="result && chartProps" :chart="up.chart || 'bar_h'" :chart-props="chartProps" />
  </div>
</template>

<style scoped>
.viz-embed { border: 1px solid var(--border); border-radius: 4px; padding: 0.75rem; }
.viz-msg { color: var(--muted); font-size: 0.8rem; padding: 0.5rem; }
.viz-error { color: #dc2626; }
</style>
