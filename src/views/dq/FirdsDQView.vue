<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import GaugeChart from '../../components/charts/GaugeChart.vue'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.vue'

onMounted(() => { document.title = 'FIRDS Data Quality — GMR' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/firds'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const tickerPct = computed(() => data.value ? data.value.ticker_rate : 0)
const typeBars = computed(() => (data.value?.by_instrument_type || []).map(t => ({ label: t.type, value: t.count })))
const venueBars = computed(() => (data.value?.by_venue || []).map(v => ({ label: v.venue, value: v.count })))
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">&larr; Data Quality</router-link><h1>FIRDS Instruments</h1><p class="dq-sub">ESMA Financial Instruments Reference Data — ISIN coverage, instrument types, trading venues</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">Loading...</div>
    <template v-else-if="data">
      <div class="dq-stats"><StatCard :value="data.total.toLocaleString()" label="Total Instruments (with ISIN)" /><StatCard :value="data.with_ticker.toLocaleString()" label="With Ticker" /><StatCard :value="data.without_ticker.toLocaleString()" label="Without Ticker" /></div>
      <div class="dq-gauges"><GaugeChart :value="tickerPct" label="Ticker Coverage" /></div>
      <section class="dq-section"><h2>By Instrument Type</h2><HorizontalBarChart :data="typeBars" :max-bars="15" /></section>
      <section class="dq-section"><h2>Top Trading Venues (MIC)</h2><HorizontalBarChart :data="venueBars" :max-bars="10" /></section>
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
