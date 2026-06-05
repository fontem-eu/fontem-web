<script setup>
import { ref, onMounted } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'

onMounted(() => { document.title = 'Data Quality — Fontem Admin' })

const loading = ref(true)
const stats = ref(null)
const error = ref(null)
const freshness = ref(null)
const freshnessError = ref(null)

const pipelines = [
  { id: 'overview', title: 'Data Quality Overview', desc: 'Cross-source overlap, country code consistency, and field completeness across all data sources.', icon: '📊', featured: true },
  { id: 'connectedness', title: 'Graph Connectedness', desc: 'Degree distribution per entity type — how many nodes are stranded vs well-integrated. Reveals where entity resolution still has work to do.', icon: '🔗' },
  { id: 'triples', title: 'Triple Store', desc: 'RDF inventory in Virtuoso — total triples, per-named-graph counts, and class/predicate breakdowns. Shows what is actually in the SPARQL store.', icon: '🧬' },
  { id: 'contracts', title: 'TED Contracts', desc: 'EU public procurement awards — daily volume, country coverage, field completeness, match quality.', icon: '📄' },
  { id: 'gleif', title: 'GLEIF Companies', desc: 'Global LEI entity data — active/inactive, country distribution, parent-child relationships.', icon: '🏢' },
  { id: 'edgar', title: 'US EDGAR', desc: 'SEC financial statements — filing coverage by year, XBRL field completeness, sparse companies.', icon: '📊' },
  { id: 'esef', title: 'EU ESEF', desc: 'European XBRL financials — filings by country and year, field coverage, LEI resolution.', icon: '📈' },
  { id: 'lobbying', title: 'EU Lobbying', desc: 'Transparency Register — registrations over time, cost distribution, EP passes, company matching.', icon: '🏛' },
  { id: 'trade-edges', title: 'Trade Edges', desc: 'Materialized authority↔company relationships — pair counts, value aggregation.', icon: '🔗' },
  { id: 'dedup', title: 'Deduplication', desc: 'SAME_AS queue — pending review, auto-merged, resolution rate.', icon: '🔍' },
  { id: 'sanctions', title: 'Sanctions', desc: 'Sanctioned entities — persons vs organisations, regime coverage, company matching.', icon: '🚫' },
  { id: 'firds', title: 'FIRDS Instruments', desc: 'ESMA reference data — ISIN/ticker coverage, instrument types, trading venues.', icon: '📋' },
  { id: 'cdp', title: 'CDP Climate', desc: 'CDP climate disclosure — score distribution, reporting year coverage.', icon: '🌍' },
  { id: 'nuts', title: 'NUTS Regions', desc: 'Eurostat NUTS classification — geographic coverage of companies and authorities.', icon: '🗺' },
  { id: 'eu-knowledge-graph', title: 'EU Knowledge Graph', desc: 'EU Cohesion Policy projects — funding distribution, beneficiary links, NUTS coverage.', icon: '🇪🇺' },
  { id: 'etl-runs', title: 'ETL Runs', desc: 'Recent CronJob invocations — success / failure / crashed pods. Replaces the legacy Uptime-Kuma pings; one row per loader run via events.etl_run.', icon: '⏱' },
]

async function loadOverview() {
  try {
    const resp = await fetch('/api/data-quality')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    stats.value = await resp.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function loadFreshness() {
  // Hit the live freshness endpoint. The original
  // `/api/data-quality/source-freshness` URL was a 404 — no such
  // endpoint ever existed; the typo + a shape mismatch (the view
  // expected per-source rows with stale/age fields) left a
  // permanent "Source freshness unavailable: HTTP 404" banner on
  // the dashboard. The actual endpoint returns the latest contract
  // load + a per-source-system count for financial filings.
  try {
    const resp = await fetch('/api/data-quality/freshness')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    freshness.value = {
      latest_contract_load: data.latest_contract_load,
      contract_date_range: data.contract_date_range || null,
      financial_sources: data.financial_sources || [],
    }
  } catch (e) {
    freshnessError.value = e.message
  }
}

onMounted(loadOverview)
onMounted(loadFreshness)

function formatTimestamp(ts) {
  if (!ts) return '—'
  try {
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return ts
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return ts }
}

function fmt(n) {
  if (n === '—' || n == null) return '—'
  return Number(n).toLocaleString()
}

function pipelineStat(id) {
  if (!stats.value) return ''
  const g = stats.value.graph?.nodes || {}
  const m = {
    contracts: g.Contract,
    gleif: g.Company,
    edgar: null,
    esef: null,
    lobbying: g.Lobbyist,
    'trade-edges': null,
    dedup: stats.value.matching?.same_as_pending,
    sanctions: g.SanctionedEntity,
    firds: null,
    cdp: null,
    nuts: g.NUTSRegion,
    'eu-knowledge-graph': g.CohesionProject,
  }
  const v = m[id]
  if (v == null) return ''
  return fmt(v)
}
</script>

<template>
  <div class="dqh">
    <header class="dqh-header">
      <div>
        <router-link to="/admin" class="dqh-back">&larr; Admin</router-link>
        <h1>{{ $t('data_quality_hub.data_quality') }}</h1>
        <p class="dqh-sub">Per-pipeline dashboards — drill into each ETL to spot gaps, trends, and anomalies.</p>
      </div>
      <ThemeToggle />
    </header>

    <div v-if="loading" class="dqh-loading">{{ $t('data_quality_hub.loading_overview') }}</div>
    <div v-else-if="error" class="dqh-error">{{ error }}</div>

    <template v-else>
      <!-- Overview stats bar -->
      <div v-if="stats?.graph" class="dqh-overview">
        <div v-for="[label, count] in Object.entries(stats.graph.nodes)" :key="label" class="dqh-stat">
          <span class="dqh-stat-num">{{ fmt(count) }}</span>
          <span class="dqh-stat-label">{{ label }}</span>
        </div>
      </div>

      <!-- Data freshness panel — driven by /api/data-quality/freshness.
           Three sub-blocks rendered conditionally based on whatever the
           backend returned: latest contract load timestamp, contract
           publication-date range, financial-filing counts per source. -->
      <section
        v-if="freshness && (freshness.latest_contract_load || freshness.contract_date_range || freshness.financial_sources?.length)"
        class="dqh-freshness"
        data-testid="source-freshness"
      >
        <h2>{{ $t('data_quality_hub.data_freshness') }}</h2>
        <dl class="dqh-freshness-list" data-testid="dqh-freshness-list">
          <template v-if="freshness.latest_contract_load">
            <dt>{{ $t('data_quality_hub.latest_contract_load') }}</dt>
            <dd data-testid="freshness-latest-contract-load">{{ formatTimestamp(freshness.latest_contract_load) }}</dd>
          </template>
          <template v-if="freshness.contract_date_range?.earliest || freshness.contract_date_range?.latest">
            <dt>Contract publication range</dt>
            <dd data-testid="freshness-contract-range">
              {{ freshness.contract_date_range.earliest || '—' }} → {{ freshness.contract_date_range.latest || '—' }}
            </dd>
          </template>
          <template v-if="freshness.financial_sources?.length">
            <dt>Financial sources</dt>
            <dd data-testid="freshness-financial-sources">
              <span
                v-for="src in freshness.financial_sources"
                :key="src.source"
                class="dqh-source-chip"
              >{{ src.source }} <span class="dqh-source-count">{{ fmt(src.n) }}</span></span>
            </dd>
          </template>
        </dl>
      </section>
      <div v-else-if="freshnessError" class="dqh-freshness-error" data-testid="dqh-freshness-error">
        Data freshness unavailable: {{ freshnessError }}
      </div>

      <!-- Pipeline grid -->
      <div class="dqh-grid">
        <router-link
          v-for="p in pipelines"
          :key="p.id"
          :to="`/data-quality/${p.id}`"
          class="dqh-card"
          :class="{ 'dqh-card--featured': p.featured }"
        >
          <div class="dqh-card-header">
            <span class="dqh-card-icon">{{ p.icon }}</span>
            <h2>{{ p.title }}</h2>
            <span v-if="pipelineStat(p.id)" class="dqh-card-badge">{{ pipelineStat(p.id) }}</span>
          </div>
          <p>{{ p.desc }}</p>
        </router-link>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dqh { max-width: 960px; margin: 0 auto; padding: 0 1rem 4rem; }
.dqh-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.dqh-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.dqh-back { font-size: 0.85rem; color: var(--accent); text-decoration: none; }
.dqh-sub { font-size: 0.85rem; color: var(--muted); margin-top: 0.2rem; }
.dqh-loading, .dqh-error { text-align: center; padding: 3rem; color: var(--muted); }
.dqh-error { color: #dc2626; }

.dqh-overview { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; padding: 0.75rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
.dqh-stat { text-align: center; flex: 1; min-width: 80px; }
.dqh-stat-num { display: block; font-size: 1.1rem; font-weight: 700; color: var(--accent); }
.dqh-stat-label { font-size: 0.65rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }

.dqh-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
.dqh-card { display: block; padding: 1.25rem; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: inherit; transition: border-color 0.15s; }
.dqh-card:hover { border-color: var(--accent); }
.dqh-card-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
.dqh-card-icon { font-size: 1.2rem; }
.dqh-card h2 { font-size: 1rem; font-weight: 700; color: var(--accent); margin: 0; flex: 1; }
.dqh-card-badge { font-size: 0.7rem; font-weight: 600; background: var(--accent); color: #fff; padding: 0.15rem 0.4rem; border-radius: 4px; }
.dqh-card p { font-size: 0.82rem; color: var(--muted); margin: 0; line-height: 1.4; }
.dqh-card--featured { grid-column: 1 / -1; border-color: var(--accent); border-width: 2px; }

.dqh-freshness { margin-bottom: 1.5rem; padding: 1rem 1.25rem; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
.dqh-freshness h2 { font-size: 0.95rem; font-weight: 700; color: var(--accent); margin: 0 0 0.5rem; }
.dqh-freshness-list { display: grid; grid-template-columns: max-content 1fr; gap: 0.35rem 1rem; font-size: 0.85rem; margin: 0; }
.dqh-freshness-list dt { color: var(--muted); font-weight: 500; }
.dqh-freshness-list dd { margin: 0; color: var(--text); font-variant-numeric: tabular-nums; }
.dqh-source-chip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.1rem 0.55rem; margin-right: 0.4rem; border-radius: 999px; background: var(--accent-bg, rgba(10, 102, 194, 0.10)); color: var(--accent); font-size: 0.78rem; font-weight: 500; }
.dqh-source-count { color: var(--muted); font-weight: 600; }
.dqh-freshness-error { margin-bottom: 1.5rem; padding: 0.75rem 1rem; background: var(--surface); border: 1px dashed var(--border); border-radius: 8px; color: var(--muted); font-size: 0.82rem; }
</style>
