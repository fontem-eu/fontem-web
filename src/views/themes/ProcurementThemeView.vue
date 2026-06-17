<script setup>
/**
 * Procurement theme — the investigative landing for "where public money
 * goes", composed across the procurement sources (TED today; corporate
 * ownership next). Theme pages frame the data by question, not by feed;
 * the per-source operational dashboards remain the drill-down + health
 * layer (SourcePipelinePanel below links straight to them).
 */
import { ref, computed, onMounted } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.vue'
import SourcePipelinePanel from '../../components/SourcePipelinePanel.vue'

onMounted(() => { document.title = 'Public Procurement — Fontem' })

const loading = ref(true)
const valueQuality = ref(null)
const byCountry = ref([])

async function load() {
  try {
    const [vq, bc] = await Promise.all([
      fetch('/api/data-quality/contracts/value-quality'),
      fetch('/api/data-quality/contracts/by-country'),
    ])
    if (vq.ok) valueQuality.value = await vq.json()
    if (bc.ok) byCountry.value = await bc.json()
  } finally {
    loading.value = false
  }
}
onMounted(load)

function fmtEur(n) {
  if (n == null) return '—'
  if (n >= 1e9) return `€${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `€${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `€${(n / 1e3).toFixed(0)}k`
  return `€${Math.round(n)}`
}
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString() }

// Trusted total = the confidence-gated per-country sums (low-confidence
// contracts are already excluded server-side via trusted_value_sum).
const trustedTotal = computed(() =>
  byCountry.value.reduce((s, c) => s + (c.total_eur || 0), 0))
const countryBars = computed(() =>
  [...byCountry.value]
    .sort((a, b) => (b.total_eur || 0) - (a.total_eur || 0))
    .slice(0, 20)
    .map(c => ({ label: c.country, value: c.total_eur || 0 })))
const trustedPct = computed(() => {
  const vq = valueQuality.value
  if (!vq || !vq.total) return null
  return Math.round((1 - vq.flagged_low_confidence / vq.total) * 100)
})
const flagBars = computed(() => {
  const bf = valueQuality.value?.by_flag || []
  return bf.filter(f => f.flag !== 'ok')
    .map(f => ({ label: f.flag.replace(/_/g, ' '), value: f.count }))
    .sort((a, b) => b.value - a.value)
})
</script>

<template>
  <div class="theme">
    <header class="theme-hdr">
      <div>
        <router-link to="/data-quality" class="theme-back">← Data Quality</router-link>
        <h1>💶 Public Procurement</h1>
        <p class="theme-sub">Where EU public money goes — contract awards, value flows, and the
          data-quality behind every headline figure.</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="loading" class="theme-loading">Loading procurement data…</div>

    <template v-else>
      <div class="theme-stats">
        <StatCard :value="fmt(valueQuality?.total)" label="Contracts" />
        <StatCard :value="fmtEur(trustedTotal)" label="Trusted value" />
        <StatCard :value="trustedPct == null ? '—' : trustedPct + '%'" label="Values trusted" />
        <StatCard :value="fmt(byCountry.length)" label="Countries" />
      </div>

      <section class="theme-section">
        <h2>Spend by country (confidence-gated)</h2>
        <p class="theme-hint">Low-confidence values are excluded — see the data-quality panel below.</p>
        <HorizontalBarChart :data="countryBars" :max-bars="20" :format-value="fmtEur" color="#16a34a" />
      </section>

      <section v-if="flagBars.length" class="theme-section">
        <h2>Data-quality — values held back from totals</h2>
        <p class="theme-hint">{{ fmt(valueQuality?.flagged_low_confidence) }} contracts
          ({{ valueQuality?.low_confidence_pct }}%) are flagged and excluded from the figures above.</p>
        <HorizontalBarChart :data="flagBars" :max-bars="10" color="#dc2626" />
      </section>

      <!-- Cross-source panel placeholder: rolling contract winners up to
           their ultimate corporate parent needs the GLEIF ownership graph,
           which is re-ingesting (item 7). Lands as that completes. -->
      <section class="theme-section theme-soon">
        <h2>Corporate-group rollup <span class="theme-badge">coming soon</span></h2>
        <p class="theme-hint">Winners rolled up to their ultimate parent — so "Company X won €2M"
          becomes "Group Y won €400M across 30 subsidiaries". Arrives as the ownership graph re-ingest lands.</p>
      </section>

      <section class="theme-section">
        <h2>Source &amp; pipeline</h2>
        <SourcePipelinePanel source-id="contracts" title="TED Contracts — pipeline health" />
        <router-link to="/data-quality/contracts" class="theme-drill">
          Open the operational TED Contracts dashboard →
        </router-link>
      </section>
    </template>
  </div>
</template>

<style scoped>
.theme { max-width: 960px; margin: 0 auto; padding: 0 1rem 4rem; }
.theme-hdr { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.theme-hdr h1 { font-size: 1.5rem; font-weight: 700; margin: 0.3rem 0 0; }
.theme-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.theme-sub { font-size: 0.9rem; color: var(--muted); margin-top: 0.3rem; max-width: 60ch; }
.theme-loading { text-align: center; padding: 3rem; color: var(--muted); }
.theme-stats { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.theme-section { margin-bottom: 1.75rem; }
.theme-section h2 { font-size: 1rem; font-weight: 700; margin: 0 0 0.3rem; }
.theme-hint { font-size: 0.82rem; color: var(--muted); margin: 0 0 0.6rem; }
.theme-soon { opacity: 0.7; }
.theme-badge { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 0.1rem 0.5rem; margin-left: 0.4rem; vertical-align: middle; }
.theme-drill { display: inline-block; margin-top: 0.6rem; font-size: 0.88rem; color: var(--accent); text-decoration: none; font-weight: 600; }
</style>
