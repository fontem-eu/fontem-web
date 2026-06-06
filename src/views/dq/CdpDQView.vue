<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.vue'

onMounted(() => { document.title = 'CDP Data Quality — Fontem' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/cdp'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const scoreBars = computed(() => (data.value?.score_distribution || []).map(s => ({ label: s.score, value: s.count })))
const yearBars = computed(() => (data.value?.by_reporting_year || []).map(y => ({ label: y.year, value: y.count })))
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link><h1>{{ $t('cdp_d_q.cdp_climate_disclosure') }}</h1><p class="dq-sub">{{ $t('cdp_d_q.cdp_scores_and_climate_reporting_score_d') }}</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <template v-else-if="data">
      <div class="dq-stats"><StatCard :value="data.companies_with_score.toLocaleString()" label="Companies with CDP Score" /></div>
      <section class="dq-section"><h2>{{ $t('cdp_d_q.score_distribution') }}</h2><HorizontalBarChart :data="scoreBars" :max-bars="10" /></section>
      <section class="dq-section"><h2>{{ $t('cdp_d_q.by_reporting_year') }}</h2><HorizontalBarChart :data="yearBars" :max-bars="10" /></section>
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
