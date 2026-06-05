<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../../components/ThemeToggle.vue'
import StatCard from '../../components/charts/StatCard.vue'
import HorizontalBarChart from '../../components/charts/HorizontalBarChart.vue'

onMounted(() => { document.title = 'Graph Connectedness — Fontem' })

const data = ref(null)
const loading = ref(true)
const error = ref(null)

async function load() {
  try {
    const r = await fetch('/api/data-quality/connectedness')
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    data.value = await r.json()
  } catch (e) {
    error.value = e.message || 'Failed to load connectedness'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const fmt = (n) => n == null ? '—' : Number(n).toLocaleString()
const fmtPct = (n) => n == null ? '—' : `${n.toFixed(1)}%`

const totalNodes = computed(
  () => (data.value?.per_type || []).reduce((s, t) => s + (t.count || 0), 0),
)
const totalIsolated = computed(
  () => (data.value?.per_type || []).reduce((s, t) => s + (t.isolated_count || 0), 0),
)
const isolatedPct = computed(
  () => totalNodes.value ? (totalIsolated.value / totalNodes.value) * 100 : 0,
)

function histogramBars(type) {
  return type.histogram.map((b) => ({ label: b.bucket, value: b.count }))
}

const generatedAt = computed(() => {
  if (!data.value?.generated_at) return null
  return new Date(data.value.generated_at).toLocaleString()
})
</script>

<template>
  <div class="dq">
    <header class="dq-hdr">
      <div>
        <router-link to="/data-quality" class="dq-back">&larr; Data Quality</router-link>
        <h1>{{ $t('connectedness_d_q.graph_connectedness') }}</h1>
        <p class="dq-sub">
          How well each entity type is wired into the rest of the graph.
          Isolated = nodes with zero relationships. High isolation on a
          type usually means that data source landed but entity
          resolution hasn't caught up yet.
        </p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="loading" class="dq-loading">{{ $t('app.loading_2') }}</div>
    <div v-else-if="error" class="dq-error" role="alert">
      Couldn't load connectedness: {{ error }}
    </div>

    <template v-else-if="data">
      <div class="dq-stats">
        <StatCard :value="fmt(totalNodes)" label="Total Nodes" />
        <StatCard :value="fmt(totalIsolated)" label="Isolated" />
        <StatCard :value="fmtPct(isolatedPct)" label="Isolated %" />
      </div>

      <p v-if="generatedAt" class="dq-cachenote">
        Snapshot from {{ generatedAt }} &middot; refreshed hourly
      </p>

      <section class="dq-section">
        <h2>{{ $t('connectedness_d_q.per_type_summary') }}</h2>
        <div class="dq-table-wrap">
          <table class="dq-table">
            <thead>
              <tr>
                <th>{{ $t('app.entity_type') }}</th>
                <th class="num">{{ $t('connectedness_d_q.count') }}</th>
                <th class="num">{{ $t('connectedness_d_q.isolated') }}</th>
                <th class="num">{{ $t('connectedness_d_q.isolated_2') }}</th>
                <th class="num">{{ $t('connectedness_d_q.min') }}</th>
                <th class="num">{{ $t('connectedness_d_q.median') }}</th>
                <th class="num">{{ $t('connectedness_d_q.mean') }}</th>
                <th class="num">p95</th>
                <th class="num">{{ $t('connectedness_d_q.max') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in data.per_type" :key="t.entity_type">
                <td>{{ t.entity_type }}</td>
                <td class="num">{{ fmt(t.count) }}</td>
                <td class="num">{{ fmt(t.isolated_count) }}</td>
                <td class="num" :class="{ 'hot': t.isolated_pct > 50 }">
                  {{ fmtPct(t.isolated_pct) }}
                </td>
                <td class="num">{{ fmt(t.min_degree) }}</td>
                <td class="num">{{ fmt(t.median_degree) }}</td>
                <td class="num">{{ t.mean_degree?.toFixed(2) ?? '—' }}</td>
                <td class="num">{{ fmt(t.p95_degree) }}</td>
                <td class="num">{{ fmt(t.max_degree) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="dq-section">
        <h2>{{ $t('connectedness_d_q.degree_distribution_per_type') }}</h2>
        <p class="dq-help">
          How many nodes fall in each connection-count bucket. A pile
          stuck on "0" means many orphans for that type; a long right
          tail means a few hubs dominate.
        </p>
        <div class="dq-hist-grid">
          <div v-for="t in data.per_type" :key="t.entity_type" class="dq-hist-card">
            <h3>{{ t.entity_type }}</h3>
            <HorizontalBarChart :data="histogramBars(t)" :max-bars="8" />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dq { max-width: 1100px; margin: 0 auto; padding: 0 1rem 4rem; }
.dq-hdr { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.dq-hdr h1 { font-size: 1.3rem; font-weight: 700; margin: 0.3rem 0 0; }
.dq-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.dq-sub { font-size: 0.82rem; color: var(--muted); margin-top: 0.15rem; max-width: 640px; line-height: 1.45; }
.dq-loading, .dq-error { text-align: center; padding: 3rem; color: var(--muted); }
.dq-error { color: #dc2626; }
.dq-cachenote { font-size: 0.75rem; color: var(--muted); margin: 0 0 1.25rem; font-style: italic; }

.dq-stats { display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
.dq-section { margin-bottom: 2.5rem; }
.dq-section h2 { font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; }
.dq-help { font-size: 0.8rem; color: var(--muted); margin: -0.25rem 0 0.75rem; max-width: 640px; }

.dq-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
.dq-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.dq-table th, .dq-table td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
.dq-table thead th { background: var(--surface); font-weight: 600; color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; }
.dq-table tbody tr:last-child td { border-bottom: none; }
.dq-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.dq-table .hot { color: #dc2626; font-weight: 600; }

.dq-hist-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; }
.dq-hist-card { padding: 0.85rem 1rem 0.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
.dq-hist-card h3 { font-size: 0.85rem; font-weight: 700; margin: 0 0 0.35rem; color: var(--accent); }
</style>
