<script setup>
import { ref, onMounted, computed } from 'vue'
import SourcePipelinePanel from '../../components/SourcePipelinePanel.vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import PocketableChart from '../../components/charts/PocketableChart.vue'

onMounted(() => { document.title = 'ESEF Data Quality — Dargle' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/esef'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const countryBars = computed(() => (data.value?.by_country || []).map(c => ({ label: c.country, value: c.count })))
const fieldBars = computed(() => Object.entries(data.value?.field_coverage || {}).map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v })))
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link><h1>{{ $t('esef_d_q.eu_esef_financials') }}</h1><p class="dq-sub">{{ $t('esef_d_q.european_financial_statements_xbrl_cover') }}</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <template v-else-if="data">
      <SourcePipelinePanel source-id="eu-listings" />

      <div class="dq-stats"><PocketableChart
        chart="stat"
        chart-key="esef_companies"
        :chart-props="{ value: data.companies.toLocaleString(), label: 'EU Companies' }"
        name="EU Companies"
      /><PocketableChart
        chart="stat"
        chart-key="esef_financial_years"
        :chart-props="{ value: data.financial_years.toLocaleString(), label: 'Financial Years' }"
        name="Financial Years"
      /></div>
      <section class="dq-section"><h2>{{ $t('app.filings_by_year') }}</h2><PocketableChart
        chart="ts_bar"
        chart-key="esef_by_year"
        :chart-props="{ data: data.by_year, valueLabel: 'Filings' }"
        :name="$t('app.filings_by_year')"
      /></section>
      <section class="dq-section"><h2>{{ $t('esef_d_q.filings_by_country') }}</h2><PocketableChart
        chart="bar_h"
        chart-key="esef_by_country"
        :chart-props="{ data: countryBars }"
        :name="$t('esef_d_q.filings_by_country')"
      /></section>
      <section class="dq-section"><h2>{{ $t('app.xbrl_field_coverage') }}</h2><PocketableChart
        chart="bar_h"
        chart-key="esef_field_coverage"
        :chart-props="{ data: fieldBars, format: 'pct', color: '#16a34a' }"
        :name="$t('app.xbrl_field_coverage')"
      /></section>
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
.dq-section { margin-bottom: 2rem; }
.dq-section h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; }
</style>
