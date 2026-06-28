<script setup>
/**
 * PocketableChart — wraps any chart primitive (via ChartSpec) and puts the
 * shared actions menu (PocketButton in ⋮ mode: Save to pocket + Download as
 * image) in a slim header row above the chart, so it never overlaps the
 * chart's own controls (e.g. the time-series granularity selector). The
 * snapshot config is built from the same props that render the chart, so
 * what you save is what you see.
 */
import { ref, computed } from 'vue'
import ChartSpec from './ChartSpec.vue'
import PocketButton from '../PocketButton.vue'
import { serializeChartProps } from '../../widgets/chartSnapshot.js'

const props = defineProps({
  chart: { type: String, required: true },
  chartProps: { type: Object, default: () => ({}) },
  name: { type: String, default: '' },
  // new abstraction: when set, pocket a {dq_chart, {chart_key}} recipe (no inline data)
  chartKey: { type: String, default: '' },
  // extra recipe params for parameterized DQ charts (e.g. { entity_type } / { graph_iri })
  dataParams: { type: Object, default: () => ({}) },
  // Reserved for future opt-out; the menu is always shown today.
  savable: { type: Boolean, default: true },
})

const bodyRef = ref(null)
const captureTarget = () => bodyRef.value

const snapshotConfig = computed(() => ({
  chart: props.chart,
  props: serializeChartProps(props.chartProps),
  title: props.name,
}))

// With a chart_key the pocket stores only a recipe — the data is refetched
// from Fontem on render, so nothing inline can be injected.
const pocketWidgetType = computed(() => (props.chartKey ? 'dq_chart' : 'chart_snapshot'))
const pocketConfig = computed(() =>
  props.chartKey
    ? { data_params: { chart_key: props.chartKey, ...props.dataParams }, ui_params: {} }
    : snapshotConfig.value,
)
</script>

<template>
  <div class="pocketable-chart" data-testid="pocketable-chart">
    <div v-if="savable" class="pc-toolbar">
      <PocketButton
        :widget-type="pocketWidgetType"
        :config="pocketConfig"
        :default-name="name"
        :capture-target="captureTarget"
      />
    </div>
    <div ref="bodyRef" class="pc-body">
      <ChartSpec :chart="chart" :chart-props="chartProps" />
    </div>
  </div>
</template>

<style scoped>
.pocketable-chart { position: relative; }
.pc-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-height: 20px;
  margin-bottom: 2px;
}
</style>
