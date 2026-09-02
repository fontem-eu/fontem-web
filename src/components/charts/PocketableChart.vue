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

// The pocket only ever stores a recipe (params) — the data is refetched from
// Dargle on render, so nothing inline can be injected. A chart must declare a
// chart-key to be savable.
const pocketConfig = computed(() => ({
  data_params: { chart_key: props.chartKey, ...props.dataParams },
  ui_params: {},
}))
</script>

<template>
  <div class="pocketable-chart" data-testid="pocketable-chart">
    <div v-if="savable && chartKey" class="pc-toolbar">
      <PocketButton
        widget-type="dq_chart"
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
