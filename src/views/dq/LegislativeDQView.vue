<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import PocketableChart from '../../components/charts/PocketableChart.vue'

onMounted(() => { document.title = 'EU Legislation Data Quality — Fontem' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/legislative'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const eliPct = computed(() => data.value?.eli_coverage != null ? Math.round(data.value.eli_coverage * 100) : 0)
const decadeBars = computed(() => (data.value?.works_by_decade || []).map(d => ({ label: d.decade, value: d.works })))
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link><h1>{{ $t('legislative_d_q.title') }}</h1><p class="dq-sub">{{ $t('legislative_d_q.subtitle') }}</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <template v-else-if="data">
      <div class="dq-stats">
        <PocketableChart
chart="stat" chart-key="leg_works"
          :chart-props="{ value: data.works.toLocaleString(), label: 'Legal Acts (works)' }" name="Legal Acts (works)" />
        <PocketableChart
chart="stat" chart-key="leg_expressions"
          :chart-props="{ value: data.expressions.toLocaleString(), label: 'Language Versions' }" name="Language Versions" />
        <PocketableChart
chart="stat" chart-key="leg_manifestations"
          :chart-props="{ value: data.manifestations.toLocaleString(), label: 'Published Formats' }" name="Published Formats" />
        <PocketableChart
chart="stat" chart-key="leg_triples"
          :chart-props="{ value: data.triples.toLocaleString(), label: 'Mirror Triples' }" name="Mirror Triples" />
      </div>

      <div class="dq-gauges">
        <PocketableChart
chart="gauge" chart-key="leg_eli_gauge"
          :chart-props="{ value: eliPct, label: 'Acts with an ELI identifier' }" name="Acts with an ELI identifier" />
      </div>

      <div v-if="decadeBars.length" class="dq-section">
        <h2>{{ $t('legislative_d_q.by_decade') }}</h2>
        <PocketableChart chart="bars" chart-key="leg_by_decade" :chart-props="{ items: decadeBars }" name="Acts by decade" />
      </div>

      <div class="dq-section">
        <h2>{{ $t('legislative_d_q.detail') }}</h2>
        <p class="dq-sub">
          {{ $t('legislative_d_q.span') }}: {{ data.earliest_work_date || '—' }} → {{ data.latest_work_date || '—' }} ·
          {{ $t('legislative_d_q.graph') }}: <code>{{ data.graph }}</code>
        </p>
        <p class="dq-sub">{{ $t('legislative_d_q.eli_note') }}</p>
      </div>
    </template>
    <div v-else class="dq-loading">{{ $t('legislative_d_q.unavailable') }}</div>
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
.dq-gauges { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.dq-section { margin-bottom: 1.75rem; }
.dq-section h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.6rem; }
code { font-size: 0.78rem; }
</style>
