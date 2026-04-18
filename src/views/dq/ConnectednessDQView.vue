<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.vue'

onMounted(() => { document.title = 'Connectedness — GMR' })

const data = ref(null)
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    const r = await fetch('/api/data-quality/connectedness')
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    data.value = await r.json()
  } catch (err) {
    error.value = err.message || 'Failed to load'
  } finally {
    loading.value = false
  }
})

const fmt = (n) => (n ?? 0).toLocaleString()
const fmtDec = (n) => (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
const fmtPct = (numer, denom) =>
  denom > 0 ? `${((numer / denom) * 100).toFixed(1)}%` : '—'

const orphanPct = computed(() =>
  data.value ? fmtPct(data.value.stats.orphan_count, data.value.stats.total_nodes) : '—',
)

const distBars = computed(() =>
  (data.value?.distribution || []).map((b) => ({ label: b.label, value: b.nodes })),
)

const hubRows = computed(() => data.value?.hubs || [])
</script>

<template>
  <div class="dq">
    <header class="dq-hdr">
      <div>
        <router-link to="/admin/data-quality" class="dq-back" data-testid="back-to-dq-hub">&larr; Data Quality</router-link>
        <h1>Graph Connectedness</h1>
        <p class="dq-sub">
          Distribution of how many edges each node has. Orphans (degree 0) are
          candidates for the reasoner to investigate — they arrived from one
          source without being linked into the broader graph.
        </p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="loading" class="dq-loading" data-testid="dq-loading">Loading…</div>
    <div v-else-if="error" class="dq-error" data-testid="dq-error">{{ error }}</div>

    <template v-else-if="data">
      <div class="dq-stats" data-testid="dq-stats">
        <StatCard :value="fmt(data.stats.total_nodes)" label="Total Nodes" />
        <StatCard :value="fmt(data.stats.total_edges)" label="Total Edges" />
        <StatCard
          :value="fmt(data.stats.orphan_count)"
          label="Orphans"
          :sub="`${orphanPct} of nodes`"
          color="#d97706"
        />
        <StatCard :value="fmtDec(data.stats.mean_degree)" label="Mean Degree" />
        <StatCard :value="fmtDec(data.stats.median_degree)" label="Median Degree" />
        <StatCard :value="fmt(data.stats.max_degree)" label="Max Degree" />
      </div>

      <section class="dq-section">
        <h2>Degree distribution</h2>
        <p class="dq-section-sub">
          Log-scale buckets. X axis is bucket size (node count per bucket), Y axis
          is the edge count range the bucket covers.
        </p>
        <HorizontalBarChart :data="distBars" :max-bars="10" data-testid="degree-chart" />
      </section>

      <section class="dq-section">
        <h2>Top hubs</h2>
        <p class="dq-section-sub">The 10 most-connected nodes in the graph.</p>
        <table class="dq-table" data-testid="hubs-table">
          <thead>
            <tr><th>Type</th><th>Name / id</th><th class="num">Edges</th></tr>
          </thead>
          <tbody>
            <tr v-for="h in hubRows" :key="`${h.labels.join('-')}-${h.id}`">
              <td>{{ (h.labels || []).join(', ') }}</td>
              <td>{{ h.id }}</td>
              <td class="num">{{ fmt(h.degree) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dq { max-width: 900px; margin: 0 auto; padding: 0 1rem 4rem; }
.dq-hdr { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.dq-hdr h1 { font-size: 1.3rem; font-weight: 700; margin: 0.3rem 0 0; }
.dq-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.dq-sub { font-size: 0.82rem; color: var(--muted); margin-top: 0.15rem; max-width: 56ch; }
.dq-loading, .dq-error { text-align: center; padding: 3rem; color: var(--muted); }
.dq-error { color: #dc2626; }
.dq-stats { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.dq-stats > * { flex: 1 1 140px; }
.dq-section { margin-bottom: 2.5rem; }
.dq-section h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.25rem; }
.dq-section-sub { font-size: 0.78rem; color: var(--muted); margin: 0 0 0.75rem; }
.dq-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.dq-table th, .dq-table td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border); }
.dq-table th { color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.7rem; }
.dq-table .num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
