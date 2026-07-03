<script setup>
/**
 * ChartSpec — renders one chart primitive from a logical
 * { chart, chartProps } spec. Single source of truth shared by
 * PocketableChart (live) and ChartSnapshotEmbed (re-render), so a
 * saved snapshot looks identical to what was on screen.
 */
import { computed } from 'vue'
import StatCard from './StatCard.vue'
import HorizontalBarChart from './HorizontalBarChart.vue'
import GaugeChart from './GaugeChart.vue'
import ZoomableBarChart from './ZoomableBarChart.vue'
import ZoomableLineChart from './ZoomableLineChart.vue'
import MultiLineChart from './MultiLineChart.vue'
import CorrMatrix from './CorrMatrix.vue'
import { resolveFormatter } from '../../widgets/chartSnapshot.js'

const props = defineProps({
  chart: { type: String, required: true },
  chartProps: { type: Object, default: () => ({}) },
})

const COMPONENTS = {
  stat: StatCard,
  bar_h: HorizontalBarChart,
  gauge: GaugeChart,
  ts_bar: ZoomableBarChart,
  ts_line: ZoomableLineChart,
  line: MultiLineChart,
  corr_matrix: CorrMatrix,
}

const component = computed(() => COMPONENTS[props.chart] || null)

// Turn a serialisable `format` string back into a formatValue fn.
// `format` is not a primitive prop, so it must not fall through.
const resolvedProps = computed(() => {
  const p = { ...props.chartProps }
  if (p.format && typeof p.formatValue !== 'function') {
    const fn = resolveFormatter(p.format)
    if (fn) p.formatValue = fn
  }
  delete p.format
  return p
})
</script>

<template>
  <component :is="component" v-if="component" v-bind="resolvedProps" />
  <div v-else class="chart-spec-unknown" data-testid="chart-spec-unknown">
    {{ $t('widget_renderer.unknown_widget_type') }}<code>{{ chart }}</code>
  </div>
</template>

<style scoped>
.chart-spec-unknown {
  padding: 1rem;
  border: 1px dashed var(--border);
  border-radius: 4px;
  color: var(--muted);
  font-size: 0.8rem;
  text-align: center;
}
</style>
