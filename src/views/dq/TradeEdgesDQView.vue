<script setup>
import { ref, onMounted } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'

onMounted(() => { document.title = 'Trade Edges Data Quality — GMR' })
const data = ref(null)
const loading = ref(true)
const fmtEur = (v) => v != null ? new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) : '-'
onMounted(async () => {
  try { const r = await fetch('/api/data-quality/trade-edges'); if (r.ok) data.value = await r.json() } catch { /* */ }
  loading.value = false
})
</script>
<template>
  <div class="dq"><header class="dq-hdr"><div><router-link to="/data-quality" class="dq-back">&larr; Data Quality</router-link><h1>Trade Edges</h1><p class="dq-sub">Materialized authority-company trade relationships from contracts</p></div><ThemeToggle /></header>
    <div v-if="loading" class="dq-loading">Loading...</div>
    <template v-else-if="data">
      <div class="dq-stats"><StatCard :value="(data.trade_pairs || 0).toLocaleString()" label="Trade Pairs" /><StatCard :value="fmtEur(data.total_eur)" label="Total EUR Value" /><StatCard :value="(data.total_contracts || 0).toLocaleString()" label="Total Contracts" /></div>
      <p class="dq-note">Trade edges are materialized from contract data. Run <code>materialize_trade_edges.py</code> to refresh.</p>
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
.dq-note { font-size: 0.82rem; color: var(--muted); line-height: 1.5; }
.dq-note code { background: var(--surface); padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.8em; }
</style>
