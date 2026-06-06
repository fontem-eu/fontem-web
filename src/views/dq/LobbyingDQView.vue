<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import GaugeChart from '../../components/charts/GaugeChart.vue'
import ZoomableBarChart from '../../components/charts/ZoomableBarChart.vue'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.vue'

onMounted(() => { document.title = 'Lobbying Data Quality — Fontem' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/lobbying'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const countryBars = computed(() => (data.value?.by_country || []).map(c => ({ label: c.country, value: c.count })))
const costBars = computed(() => (data.value?.cost_distribution || []).map(c => ({ label: c.bucket, value: c.count })))
const regTimeline = computed(() => data.value?.registrations_timeline || [])
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link><h1>{{ $t('lobbying_d_q.eu_lobbying_register') }}</h1><p class="dq-sub">{{ $t('lobbying_d_q.transparency_register_lobbyist_registrat') }}</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <template v-else-if="data">
      <div class="dq-stats"><StatCard :value="data.total.toLocaleString()" label="Lobbyists" /><StatCard :value="data.with_ep_passes.toLocaleString()" label="EP Pass Holders" /><StatCard :value="data.matched_to_company.toLocaleString()" label="Matched to Company" /></div>
      <div class="dq-gauges"><GaugeChart :value="data.match_rate" label="Company Match Rate" /></div>
      <section class="dq-section"><h2>{{ $t('lobbying_d_q.registrations_over_time') }}</h2><ZoomableBarChart :data="regTimeline" value-label="Registrations" /></section>
      <section class="dq-section"><h2>{{ $t('lobbying_d_q.top_countries') }}</h2><HorizontalBarChart :data="countryBars" /></section>
      <section class="dq-section"><h2>{{ $t('lobbying_d_q.lobbying_cost_distribution') }}</h2><HorizontalBarChart :data="costBars" color="#d97706" /></section>
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
