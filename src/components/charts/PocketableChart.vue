<script setup>
/**
 * PocketableChart — wraps any chart primitive (via ChartSpec) and
 * overlays a "save to pocket" button. The saved config is built from
 * the SAME props that render the chart, so what you save is what you
 * see. Drop-in for the DQ dashboards and anywhere else a generic
 * chart should be savable.
 */
import { computed } from 'vue'
import ChartSpec from './ChartSpec.vue'
import PocketButton from '../PocketButton.vue'
import { serializeChartProps } from '../../widgets/chartSnapshot.js'

const props = defineProps({
  chart: { type: String, required: true },
  chartProps: { type: Object, default: () => ({}) },
  name: { type: String, default: '' },
  // Opt out (e.g. when re-rendered inside a snapshot embed).
  savable: { type: Boolean, default: true },
})

const snapshotConfig = computed(() => ({
  chart: props.chart,
  props: serializeChartProps(props.chartProps),
  title: props.name,
}))
</script>

<template>
  <div class="pocketable-chart" data-testid="pocketable-chart">
    <div v-if="savable" class="pocketable-chart__save">
      <PocketButton
        widget-type="chart_snapshot"
        :config="snapshotConfig"
        :default-name="name"
      />
    </div>
    <ChartSpec :chart="chart" :chart-props="chartProps" />
  </div>
</template>

<style scoped>
.pocketable-chart { position: relative; }
.pocketable-chart__save {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 4;
  opacity: 0;
  transition: opacity 0.15s;
}
.pocketable-chart:hover .pocketable-chart__save,
.pocketable-chart__save:focus-within { opacity: 1; }
</style>
