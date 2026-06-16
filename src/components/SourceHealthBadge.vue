<script setup>
/**
 * Compact pipeline-health strip for a data source, fed by one row of
 * GET /api/data-quality/pipeline. Shows the at-a-glance red flags the
 * data-quality hub needs: freshness (a coloured dot), event volume,
 * dead-letter %, and last-run status. Renders nothing meaningful when
 * health is absent (a source not yet registered / no events DB).
 *
 * health: {
 *   stale, age_hours, last_run_status, events_total, events_30d,
 *   deadletter, deadletter_pct
 * } | null
 */
import { computed } from 'vue'

const props = defineProps({
  health: { type: Object, default: null },
})

// Worst-wins severity: red = stale or a failed run or a lossy DLQ;
// amber = running / aging / a trickle of dead-letters; green = healthy.
const level = computed(() => {
  const h = props.health
  if (!h) return 'unknown'
  if (h.stale || h.last_run_status === 'failed' || h.deadletter_pct > 1) return 'bad'
  if (h.last_run_status === 'running' || h.deadletter_pct > 0 ||
      (h.age_hours != null && h.age_hours > 24)) return 'warn'
  return 'ok'
})

const freshnessText = computed(() => {
  const h = props.health
  if (!h || h.age_hours == null) return 'no runs'
  const hrs = h.age_hours
  if (hrs < 1) return 'just now'
  if (hrs < 48) return `${Math.round(hrs)}h ago`
  return `${Math.round(hrs / 24)}d ago`
})

function fmt(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

const dlqText = computed(() => {
  const h = props.health
  if (!h || !h.deadletter) return null
  return `${h.deadletter_pct}% DLQ`
})
</script>

<template>
  <div v-if="health" class="shb" :class="`shb--${level}`" data-testid="source-health">
    <span class="shb-dot" :title="`freshness: ${freshnessText}`" aria-hidden="true" />
    <span class="shb-fresh">{{ freshnessText }}</span>
    <span class="shb-sep">·</span>
    <span class="shb-events" :title="`${health.events_total} events total`">
      {{ fmt(health.events_30d) }} <span class="shb-unit">30d</span>
    </span>
    <span v-if="dlqText" class="shb-dlq" :title="`${health.deadletter} dead-lettered events`">
      {{ dlqText }}
    </span>
    <span
v-if="health.last_run_status && health.last_run_status !== 'success'"
          class="shb-run" :class="`shb-run--${health.last_run_status}`">
      {{ health.last_run_status }}
    </span>
  </div>
</template>

<style scoped>
.shb { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.72rem; color: var(--muted); }
.shb-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--muted); }
.shb--ok .shb-dot { background: #16a34a; }
.shb--warn .shb-dot { background: #d97706; }
.shb--bad .shb-dot { background: #dc2626; }
.shb--bad .shb-fresh { color: #dc2626; font-weight: 600; }
.shb-sep { opacity: 0.5; }
.shb-unit { opacity: 0.6; }
.shb-dlq { color: #dc2626; font-weight: 600; }
.shb-run { text-transform: uppercase; letter-spacing: 0.03em; font-weight: 700; padding: 0.05rem 0.3rem; border-radius: 4px; }
.shb-run--failed { color: #fff; background: #b91c1c; }
.shb-run--running { color: #fff; background: #b45309; }
</style>
