<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import GaugeChart from '../../components/charts/GaugeChart.vue'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.vue'

onMounted(() => { document.title = 'NUTS Regions Data Quality — GMR' })
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
  <div class="dq"><header class="dq-hdr"><div><router-link to="/admin/data-quality" class="dq-back">&larr; Data Quality</router-link><h1>NUTS Regions</h1><p class="dq-sub">Eurostat NUTS classification — geographic coverage of companies and authorities</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">Loading...</div>
    <template v-else-if="data">
      <div class="dq-stats"><StatCard :value="data.total_regions.toLocaleString()" label="Total Regions" /><StatCard :value="data.companies_linked.toLocaleString()" label="Companies Linked" /><StatCard :value="data.authorities_linked.toLocaleString()" label="Authorities Linked" /></div>
      <div class="dq-gauges"><GaugeChart :value="coveragePct" label="Company Coverage" /></div>
      <section class="dq-section"><h2>Top NUTS 0 Regions by Company Count</h2><HorizontalBarChart :data="regionBars" :max-bars="15" /></section>
      <section class="dq-section"><h2>Regions by Level</h2><HorizontalBarChart :data="levelBars" :max-bars="4" /></section>
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
