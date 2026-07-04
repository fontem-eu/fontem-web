<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import PocketableChart from '../../components/charts/PocketableChart.vue'

onMounted(() => { document.title = 'Stock Prices Data Quality — Fontem' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/prices'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const freshPct = computed(() => data.value ? Math.round(data.value.fresh_ratio * 100) : 0)
const coveragePct = computed(() => data.value ? Math.round(data.value.universe_coverage_ratio * 100) : 0)
const pipelineDown = computed(() => data.value && (!data.value.index_present || !data.value.universe_present))
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link><h1>{{ $t('prices_d_q.title') }}</h1><p class="dq-sub">{{ $t('prices_d_q.subtitle') }}</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <template v-else-if="data">
      <div v-if="pipelineDown" class="dq-section">
        <div class="dq-alert">⚠ Price pipeline files missing on NFS (index: {{ data.index_present ? 'ok' : 'MISSING' }}, universe: {{ data.universe_present ? 'ok' : 'MISSING' }}) — check etl-price-universe (02:30) and usa-stock-price-fetcher (03:00).</div>
      </div>

      <div class="dq-stats">
        <PocketableChart
chart="stat" chart-key="px_tracked"
          :chart-props="{ value: data.tracked.toLocaleString(), label: 'Tickers Tracked' }" name="Tickers Tracked" />
        <PocketableChart
chart="stat" chart-key="px_fresh"
          :chart-props="{ value: data.fresh_7d.toLocaleString(), label: 'Fresh (≤7d)' }" name="Fresh (≤7d)" />
        <PocketableChart
chart="stat" chart-key="px_stale"
          :chart-props="{ value: data.stale_30d.toLocaleString(), label: 'Stale (>30d)' }" name="Stale (>30d)" />
        <PocketableChart
chart="stat" chart-key="px_nodata"
          :chart-props="{ value: data.no_data.toLocaleString(), label: 'No Data on Yahoo' }" name="No Data on Yahoo" />
        <PocketableChart
chart="stat" chart-key="px_backlog"
          :chart-props="{ value: data.universe_backlog.toLocaleString(), label: 'Universe Backlog' }" name="Universe Backlog" />
      </div>

      <div class="dq-gauges">
        <PocketableChart
chart="gauge" chart-key="px_fresh_gauge"
          :chart-props="{ value: freshPct, label: 'Freshness (7d)' }" name="Freshness (7d)" />
        <PocketableChart
chart="gauge" chart-key="px_coverage_gauge"
          :chart-props="{ value: coveragePct, label: 'Graph-Universe Coverage' }" name="Graph-Universe Coverage" />
      </div>

      <div class="dq-section">
        <h2>{{ $t('prices_d_q.detail') }}</h2>
        <p class="dq-sub">
          {{ data.universe_symbols.toLocaleString() }} symbols wanted by the graph
          ({{ data.universe_covered.toLocaleString() }} already tracked) ·
          latest bar overall: {{ data.latest_date_overall || '—' }} ·
          never fetched: {{ data.never_fetched.toLocaleString() }}
        </p>
      </div>
    </template>
  </div>
</template>
<style scoped>
.dq { max-width: 900px; margin: 0 auto; padding: 0 1rem 4rem; }
.dq-hdr { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.dq-hdr h1 { font-size: 1.3rem; font-weight: 700; margin: 0.3rem 0 0; }
.dq-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.dq-sub { font-size: 0.82rem; color: var(--muted); margin-top: 0.15rem; }
.dq-loading { text-align: center; padding: 3rem; color: var(--muted); }
.dq-stats { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.dq-gauges { display: flex; gap: 2rem; justify-content: center; margin-bottom: 2rem; }
.dq-section { margin-bottom: 2rem; }
.dq-section h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; }
.dq-alert { background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid var(--accent); border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.9rem; }
</style>
