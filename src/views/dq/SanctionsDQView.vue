<script setup>
import { ref, onMounted, computed } from 'vue'
import SourcePipelinePanel from '../../components/SourcePipelinePanel.vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import PocketableChart from '../../components/charts/PocketableChart.vue'

onMounted(() => { document.title = 'Sanctions Data Quality — Fontem' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/sanctions'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const matchPct = computed(() => data.value ? Math.round(data.value.matched_to_companies / Math.max(data.value.total, 1) * 100) : 0)
const regimeBars = computed(() => (data.value?.top_regimes || []).map(r => ({ label: r.regime, value: r.n })))
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link><h1>{{ $t('app.sanctions') }}</h1><p class="dq-sub">{{ $t('sanctions_d_q.sanctioned_entities_persons_organisation') }}</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <template v-else-if="data">
      <SourcePipelinePanel source-id="sanctions" />

      <div class="dq-stats"><PocketableChart
        chart="stat"
        chart-key="sanctions_total"
        :chart-props="{ value: data.total.toLocaleString(), label: 'Total Sanctioned Entities' }"
        name="Total Sanctioned Entities"
      /><PocketableChart
        chart="stat"
        chart-key="sanctions_persons"
        :chart-props="{ value: data.persons.toLocaleString(), label: 'Persons' }"
        name="Persons"
      /><PocketableChart
        chart="stat"
        chart-key="sanctions_entities"
        :chart-props="{ value: data.entities.toLocaleString(), label: 'Organisations' }"
        name="Organisations"
      /><PocketableChart
        chart="stat"
        chart-key="sanctions_matched"
        :chart-props="{ value: data.matched_to_companies.toLocaleString(), label: 'Matched to Companies' }"
        name="Matched to Companies"
      /></div>
      <div class="dq-gauges"><PocketableChart
        chart="gauge"
        chart-key="sanctions_match_rate"
        :chart-props="{ value: matchPct, label: 'Company Match Rate' }"
        name="Company Match Rate"
      /></div>
      <section class="dq-section"><h2>{{ $t('sanctions_d_q.top_sanction_regimes') }}</h2><PocketableChart
        chart="bar_h"
        chart-key="sanctions_top_regimes"
        :chart-props="{ data: regimeBars, maxBars: 10 }"
        :name="$t('sanctions_d_q.top_sanction_regimes')"
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
