<script setup>
/**
 * Generic per-source pipeline panel for the top of every *DQView: the
 * source-agnostic dimensions (freshness / last-run / dead-letter via
 * SourceHealthBadge, plus event volume over time) so every dashboard
 * exposes the same health surface alongside its source-specific panels.
 *
 * Fed by GET /api/data-quality/pipeline (filtered to this source) and
 * GET /api/data-quality/pipeline/{sourceId}/timeline.
 */
import { ref, computed, onMounted } from 'vue'
import SourceHealthBadge from './SourceHealthBadge.vue'
import ZoomableBarChart from './charts/ZoomableBarChart.vue'

const props = defineProps({
  sourceId: { type: String, required: true },
  title: { type: String, default: 'Pipeline health' },
})

const health = ref(null)
const timeline = ref([])
const unavailable = ref(false)

async function load() {
  try {
    const [hp, tl] = await Promise.all([
      fetch('/api/data-quality/pipeline'),
      fetch(`/api/data-quality/pipeline/${props.sourceId}/timeline?days=180`),
    ])
    if (hp.ok) {
      const all = await hp.json()
      health.value = all.find(s => s.id === props.sourceId) || null
    }
    if (tl.ok) {
      const rows = await tl.json()
      timeline.value = rows.map(r => ({ date: r.day, value: r.events }))
    }
    if (!hp.ok && !tl.ok) unavailable.value = true
  } catch {
    unavailable.value = true
  }
}
onMounted(load)

const hasTimeline = computed(() => timeline.value.length > 0)
</script>

<template>
  <section class="spp" data-testid="source-pipeline-panel">
    <div class="spp-head">
      <h2>{{ title }}</h2>
      <SourceHealthBadge :health="health" />
    </div>
    <ZoomableBarChart
      v-if="hasTimeline"
      :data="timeline"
      value-label="Events"
      :height="200"
      color="#0a66c2"
    />
    <p v-else-if="unavailable" class="spp-empty">{{ $t('source_pipeline_panel.pipeline_metrics_unavailable') }}</p>
    <p v-else class="spp-empty">{{ $t('source_pipeline_panel.no_events_recorded_in_the_window') }}</p>
  </section>
</template>

<style scoped>
.spp { margin-bottom: 1.5rem; padding: 0.85rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
.spp-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
.spp-head h2 { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0; }
.spp-empty { font-size: 0.82rem; color: var(--muted); margin: 0.4rem 0 0; }
</style>
