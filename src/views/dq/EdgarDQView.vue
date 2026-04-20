<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import ZoomableBarChart from '../../components/charts/ZoomableBarChart.vue'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.vue'

onMounted(() => { document.title = 'EDGAR Data Quality — Fontem' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/edgar'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const fieldBars = computed(() => Object.entries(data.value?.field_coverage || {}).map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v })))
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">&larr; Data Quality</router-link><h1>US EDGAR Financials</h1><p class="dq-sub">SEC financial statements — XBRL field coverage and filing trends</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">Loading...</div>
    <template v-else-if="data">
      <div class="dq-stats"><StatCard :value="data.companies.toLocaleString()" label="US Companies" /><StatCard :value="data.financial_years.toLocaleString()" label="Financial Years" /></div>
      <section class="dq-section"><h2>Filings by Year</h2><ZoomableBarChart :data="data.by_year" value-label="Filings" /></section>
      <section class="dq-section"><h2>XBRL Field Coverage (%)</h2><HorizontalBarChart :data="fieldBars" :format-value="v => v + '%'" color="#16a34a" /></section>
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
