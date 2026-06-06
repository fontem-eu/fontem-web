<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import GaugeChart from '../../components/charts/GaugeChart.vue'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.vue'

onMounted(() => { document.title = 'GLEIF Data Quality — Fontem' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/gleif'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const leiPct = computed(() => data.value ? Math.round(data.value.with_lei / Math.max(data.value.total, 1) * 100) : 0)
const activePct = computed(() => data.value ? Math.round(data.value.active / Math.max(data.value.total, 1) * 100) : 0)
const countryBars = computed(() => (data.value?.by_country || []).map(c => ({ label: c.country, value: c.count })))
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link><h1>{{ $t('gleif_d_q.gleif_companies') }}</h1><p class="dq-sub">{{ $t('gleif_d_q.global_lei_directory_entity_identificati') }}</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <template v-else-if="data">
      <div class="dq-stats"><StatCard :value="data.total.toLocaleString()" label="Total Companies" /><StatCard :value="data.with_lei.toLocaleString()" label="With LEI" /><StatCard :value="data.subsidiary_links.toLocaleString()" label="Subsidiary Links" /><StatCard :value="data.orphan_subsidiaries.toLocaleString()" label="Orphan Subsidiaries" color="#d97706" /></div>
      <div class="dq-gauges"><GaugeChart :value="leiPct" label="LEI Coverage" /><GaugeChart :value="activePct" label="Active Companies" /></div>
      <section class="dq-section"><h2>{{ $t('gleif_d_q.companies_by_country_top_30') }}</h2><HorizontalBarChart :data="countryBars" :max-bars="30" /></section>
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
