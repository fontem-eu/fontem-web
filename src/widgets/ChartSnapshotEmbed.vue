<script setup>
/**
 * Legacy `chart_snapshot` widget. The old format embedded chart DATA in the
 * document, which is no longer allowed — visualization data must be refetched
 * from Fontem. These widgets are inert: they render a notice and read no data,
 * so any forged inline data in a document is never displayed.
 */
defineProps({ config: { type: Object, default: () => ({}) } })
function storeState() { return {} }
defineExpose({ storeState, widgetType: 'chart_snapshot' })
</script>

<template>
  <div class="chart-snapshot-legacy" data-testid="widget-chart-snapshot">
    <span class="csl-icon">⚠</span>
    This saved chart uses the old inline format and can no longer be displayed.
    Re-add it from the data-quality dashboard.
  </div>
</template>

<style scoped>
.chart-snapshot-legacy {
  border: 1px dashed var(--border);
  border-radius: 4px;
  padding: 0.75rem;
  font-size: 0.8rem;
  color: var(--muted);
}
.csl-icon { margin-right: 0.4rem; }
</style>
