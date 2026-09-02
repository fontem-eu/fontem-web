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

onMounted(() => { document.title = 'Public Procurement — Dargle' })

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
        <router-link to="/data-quality" class="theme-back">{{ $t('nav.back_data_quality') }}</router-link>
        <h1>💶 {{ $t('procurement_theme.public_procurement') }}</h1>
        <p class="theme-sub">{{ $t('procurement_theme.where_eu_public_money_goes') }}</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="loading" class="theme-loading">{{ $t('procurement_theme.loading_procurement_data') }}</div>

    <template v-else>
      <div class="theme-stats">
        <StatCard :value="fmt(valueQuality?.total)" :label="$t('procurement_theme.contracts')" />
        <StatCard :value="fmtEur(trustedTotal)" :label="$t('procurement_theme.trusted_value')" />
        <StatCard :value="trustedPct == null ? '—' : trustedPct + '%'" :label="$t('procurement_theme.values_trusted')" />
        <StatCard :value="fmt(byCountry.length)" :label="$t('procurement_theme.countries')" />
      </div>

      <section class="theme-section">
        <h2>{{ $t('procurement_theme.spend_by_country_confidence_gated') }}</h2>
        <p class="theme-hint">{{ $t('procurement_theme.low_confidence_values_excluded') }}</p>
        <HorizontalBarChart :data="countryBars" :max-bars="20" :format-value="fmtEur" color="#16a34a" />
      </section>

      <section v-if="flagBars.length" class="theme-section">
        <h2>{{ $t('procurement_theme.data_quality_values_held_back') }}</h2>
        <p class="theme-hint">{{ fmt(valueQuality?.flagged_low_confidence) }} {{ $t('procurement_theme.contracts_2') }}
          ({{ valueQuality?.low_confidence_pct }}%) {{ $t('procurement_theme.are_flagged_and_excluded_from_figures') }}</p>
        <HorizontalBarChart :data="flagBars" :max-bars="10" color="#dc2626" />
      </section>

      <!-- Cross-source panel placeholder: rolling contract winners up to
           their ultimate corporate parent needs the GLEIF ownership graph,
           which is re-ingesting (item 7). Lands as that completes. -->
      <section class="theme-section theme-soon">
        <h2>{{ $t('procurement_theme.corporate_group_rollup') }} <span class="theme-badge">{{ $t('procurement_theme.coming_soon') }}</span></h2>
        <p class="theme-hint">{{ $t('procurement_theme.winners_rolled_up_to_parent') }}</p>
      </section>

      <section class="theme-section">
        <h2>{{ $t('procurement_theme.source_and_pipeline') }}</h2>
        <SourcePipelinePanel source-id="contracts" :title="$t('procurement_theme.ted_contracts_pipeline_health')" />
        <router-link to="/data-quality/contracts" class="theme-drill">
          {{ $t('procurement_theme.open_operational_ted_dashboard') }}
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
