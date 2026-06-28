<script setup>
import { ref, onMounted, computed } from 'vue'
import SourcePipelinePanel from '../../components/SourcePipelinePanel.vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import PocketableChart from '../../components/charts/PocketableChart.vue'

onMounted(() => { document.title = 'NUTS Regions Data Quality — Fontem' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/nuts'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const coveragePct = computed(() => data.value ? Math.round(data.value.company_coverage_pct) : 0)
const regionBars = computed(() => (data.value?.top_regions || []).map(r => ({ label: `${r.code} — ${r.name}`, value: r.companies })))
const levelBars = computed(() => (data.value?.by_level || []).map(l => ({ label: `Level ${l.level}`, value: l.n })))
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link><h1>{{ $t('nuts_d_q.nuts_regions') }}</h1><p class="dq-sub">{{ $t('nuts_d_q.eurostat_nuts_classification_geographic_') }}</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <template v-else-if="data">
      <SourcePipelinePanel source-id="nuts" />

      <div class="dq-stats"><PocketableChart
        chart="stat"
        chart-key="nuts_total_regions"
        :chart-props="{ value: data.total_regions.toLocaleString(), label: 'Total Regions' }"
        name="Total Regions"
      /><PocketableChart
        chart="stat"
        chart-key="nuts_companies_linked"
        :chart-props="{ value: data.companies_linked.toLocaleString(), label: 'Companies Linked' }"
        name="Companies Linked"
      /><PocketableChart
        chart="stat"
        chart-key="nuts_authorities_linked"
        :chart-props="{ value: data.authorities_linked.toLocaleString(), label: 'Authorities Linked' }"
        name="Authorities Linked"
      /></div>
      <div class="dq-gauges"><PocketableChart
        chart="gauge"
        chart-key="nuts_coverage"
        :chart-props="{ value: coveragePct, label: 'Company Coverage' }"
        name="Company Coverage"
      /></div>
      <section class="dq-section"><h2>{{ $t('nuts_d_q.top_nuts_0_regions_by_company_count') }}</h2><PocketableChart
        chart="bar_h"
        chart-key="nuts_top_regions"
        :chart-props="{ data: regionBars, maxBars: 15 }"
        :name="$t('nuts_d_q.top_nuts_0_regions_by_company_count')"
      /></section>
      <section class="dq-section"><h2>{{ $t('nuts_d_q.regions_by_level') }}</h2><PocketableChart
        chart="bar_h"
        chart-key="nuts_by_level"
        :chart-props="{ data: levelBars, maxBars: 4 }"
        :name="$t('nuts_d_q.regions_by_level')"
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
.dq-gauges { display: flex; gap: 2rem; justify-content: center; margin-bottom: 2rem; }
.dq-section { margin-bottom: 2rem; }
.dq-section h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; }
</style>
