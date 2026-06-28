<script setup>
import { ref, onMounted, computed } from 'vue'
import SourcePipelinePanel from '../../components/SourcePipelinePanel.vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import PocketableChart from '../../components/charts/PocketableChart.vue'

onMounted(() => { document.title = 'EU Knowledge Graph Data Quality — Fontem' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/eu-knowledge-graph'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const euContributionLabel = computed(() => {
  if (!data.value) return '0'
  const billions = data.value.total_eu_contribution / 1_000_000_000
  return `\u20AC${billions.toFixed(2)}B`
})
const fundBars = computed(() => (data.value?.by_fund || []).map(f => ({ label: f.fund, value: f.n })))
const countryBars = computed(() => (data.value?.by_country || []).map(c => ({ label: c.country, value: c.n })))
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link><h1>{{ $t('eu_knowledge_graph_d_q.eu_knowledge_graph') }}</h1><p class="dq-sub">{{ $t('eu_knowledge_graph_d_q.eu_cohesion_policy_projects_funding_bene') }}</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <template v-else-if="data">
      <SourcePipelinePanel source-id="eu-knowledge-graph" />

      <div class="dq-stats"><PocketableChart
        chart="stat"
        chart-key="eukg_total_projects"
        :chart-props="{ value: data.total_projects.toLocaleString(), label: 'Total Projects' }"
        name="Total Projects"
      /><PocketableChart
        chart="stat"
        chart-key="eukg_beneficiary_links"
        :chart-props="{ value: data.beneficiary_links.toLocaleString(), label: 'Beneficiary Links' }"
        name="Beneficiary Links"
      /><PocketableChart
        chart="stat"
        chart-key="eukg_eu_contribution"
        :chart-props="{ value: euContributionLabel, label: 'EU Contribution' }"
        name="EU Contribution"
      /></div>
      <section class="dq-section"><h2>{{ $t('eu_knowledge_graph_d_q.projects_by_fund_top_10') }}</h2><PocketableChart
        chart="bar_h"
        chart-key="eukg_by_fund"
        :chart-props="{ data: fundBars, maxBars: 10 }"
        :name="$t('eu_knowledge_graph_d_q.projects_by_fund_top_10')"
      /></section>
      <section class="dq-section"><h2>{{ $t('eu_knowledge_graph_d_q.projects_by_country_top_15') }}</h2><PocketableChart
        chart="bar_h"
        chart-key="eukg_by_country"
        :chart-props="{ data: countryBars, maxBars: 15 }"
        :name="$t('eu_knowledge_graph_d_q.projects_by_country_top_15')"
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
