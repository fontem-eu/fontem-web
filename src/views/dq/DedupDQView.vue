<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import PocketableChart from '../../components/charts/PocketableChart.vue'

onMounted(() => { document.title = 'Deduplication Data Quality — Fontem' })
const data = ref(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/dedup'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
const pendingPct = computed(() => data.value && data.value.total > 0 ? Math.round(data.value.pending / data.value.total * 100) : 0)
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">{{ $t('nav.back_data_quality') }}</router-link><h1>{{ $t('dedup_d_q.deduplication') }}</h1><p class="dq-sub">{{ $t('dedup_d_q.same_as_queue_duplicate_entity_resolutio') }}</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <template v-else-if="data">
      <div class="dq-stats"><PocketableChart chart="stat" :chart-props="{ value: data.pending, label: 'Pending Review', color: '#d97706' }" name="Pending Review" /><PocketableChart chart="stat" :chart-props="{ value: data.reviewed, label: 'Reviewed', color: '#16a34a' }" name="Reviewed" /><PocketableChart chart="stat" :chart-props="{ value: data.total, label: 'Total SAME_AS' }" name="Total SAME_AS" /></div>
      <div class="dq-bar-wrap">
        <div class="dq-bar">
          <div class="dq-bar-fill dq-bar-reviewed" :style="{ width: (100 - pendingPct) + '%' }"></div>
          <div class="dq-bar-fill dq-bar-pending" :style="{ width: pendingPct + '%' }"></div>
        </div>
        <div class="dq-bar-legend"><span class="dq-legend-dot" style="background:#16a34a"></span> Reviewed ({{ 100 - pendingPct }}%) <span class="dq-legend-dot" style="background:#d97706;margin-left:1rem"></span> Pending ({{ pendingPct }}%)</div>
      </div>
      <p class="dq-note">{{ $t('dedup_d_q.use_the') }}<router-link to="/admin/entity-resolution">{{ $t('app.entity_resolution') }}</router-link> tool to review pending duplicates.</p>
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
.dq-bar-wrap { margin-bottom: 1.5rem; }
.dq-bar { display: flex; height: 20px; border-radius: 6px; overflow: hidden; background: var(--surface); border: 1px solid var(--border); }
.dq-bar-reviewed { background: #16a34a; }
.dq-bar-pending { background: #d97706; }
.dq-bar-legend { font-size: 0.75rem; color: var(--muted); margin-top: 0.4rem; display: flex; align-items: center; }
.dq-legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 0.3rem; }
.dq-note { font-size: 0.82rem; color: var(--muted); }
.dq-note a { color: var(--accent); }
</style>
