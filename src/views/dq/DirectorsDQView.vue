<script setup>
import { ref, onMounted } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import GaugeChart from '../../components/charts/GaugeChart.vue'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.vue'

onMounted(() => { document.title = 'Directors Data Quality — GMR' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/directors'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/admin/data-quality" class="dq-back">&larr; Data Quality</router-link><h1>French Directors</h1><p class="dq-sub">Company directors from RNE — role distribution and data completeness</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">Loading...</div>
    <template v-else-if="data">
      <div class="dq-stats"><StatCard :value="data.persons.toLocaleString()" label="Persons" /><StatCard :value="data.director_links.toLocaleString()" label="Director Links" /><StatCard :value="data.companies_with_directors.toLocaleString()" label="Companies with Directors" /></div>
      <div class="dq-gauges"><GaugeChart :value="data.birth_year_coverage" label="Birth Year Coverage" /></div>
      <section v-if="data.roles?.length" class="dq-section"><h2>Role Distribution</h2><HorizontalBarChart :data="data.roles" /></section>
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
