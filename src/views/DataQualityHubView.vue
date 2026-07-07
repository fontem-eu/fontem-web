<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import SourceHealthBadge from '../components/SourceHealthBadge.vue'
import { THEMES } from './themes/themeConfig.js'

onMounted(() => { document.title = 'Data Quality — Fontem Admin' })

const loading = ref(true)
const stats = ref(null)
const error = ref(null)

const pipelines = [
  { id: 'overview', title: 'Data Quality Overview', desc: 'Cross-source overlap, country code consistency, and field completeness across all data sources.', icon: '📊', featured: true, theme: 'analytical'  },
  { id: 'connectedness', title: 'Graph Connectedness', desc: 'Degree distribution per entity type — how many nodes are stranded vs well-integrated. Reveals where entity resolution still has work to do.', icon: '🔗', theme: 'analytical'  },
  { id: 'triples', title: 'Triple Store', desc: 'RDF inventory in Virtuoso — total triples, per-named-graph counts, and class/predicate breakdowns. Shows what is actually in the SPARQL store.', icon: '🧬', theme: 'analytical'  },
  { id: 'contracts', title: 'TED Contracts', desc: 'EU public procurement awards — daily volume, country coverage, field completeness, match quality.', icon: '📄', theme: 'procurement'  },
  { id: 'gleif', title: 'GLEIF Companies', desc: 'Global LEI entity data — active/inactive, country distribution, parent-child relationships.', icon: '🏢', theme: 'corporate'  },
  { id: 'edgar', title: 'US EDGAR', desc: 'SEC financial statements — filing coverage by year, XBRL field completeness, sparse companies.', icon: '📊', theme: 'corporate'  },
  { id: 'esef', title: 'EU ESEF', desc: 'European XBRL financials — filings by country and year, field coverage, LEI resolution.', icon: '📈', theme: 'corporate'  },
  { id: 'lobbying', title: 'EU Lobbying', desc: 'Transparency Register — registrations over time, cost distribution, EP passes, company matching.', icon: '🏛', theme: 'influence'  },
  { id: 'trade-edges', title: 'Trade Edges', desc: 'Materialized authority↔company relationships — pair counts, value aggregation.', icon: '🔗', theme: 'analytical'  },
  { id: 'dedup', title: 'Deduplication', desc: 'SAME_AS queue — pending review, auto-merged, resolution rate.', icon: '🔍', theme: 'analytical'  },
  { id: 'sanctions', title: 'Sanctions', desc: 'Sanctioned entities — persons vs organisations, regime coverage, company matching.', icon: '🚫', theme: 'influence'  },
  { id: 'firds', title: 'FIRDS Instruments', desc: 'ESMA reference data — ISIN/ticker coverage, instrument types, trading venues.', icon: '📋', theme: 'securities'  },
  { id: 'openfigi', title: 'OpenFIGI & Funds', desc: 'Listings enrichment — security types, companies vs investment funds, unit listings.', icon: '🏦', theme: 'securities'  },
  { id: 'prices', title: 'Stock Prices', desc: 'EOD price layer — index freshness, graph-universe coverage, fetch backlog.', icon: '📈', theme: 'securities'  },
  { id: 'cdp', title: 'CDP Climate', desc: 'CDP climate disclosure — score distribution, reporting year coverage.', icon: '🌍', theme: 'climate'  },
  { id: 'nuts', title: 'NUTS Regions', desc: 'Eurostat NUTS classification — geographic coverage of companies and authorities.', icon: '🗺', theme: 'geography'  },
  { id: 'eu-knowledge-graph', title: 'EU Knowledge Graph', desc: 'EU Cohesion Policy projects — funding distribution, beneficiary links, NUTS coverage.', icon: '🇪🇺', theme: 'influence'  },
  { id: 'etl-runs', title: 'ETL Runs', desc: 'Recent CronJob invocations — success / failure / crashed pods. Replaces the legacy Uptime-Kuma pings; one row per loader run via events.etl_run.', icon: '⏱', theme: 'analytical'  },
]

const themes = THEMES

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

onMounted(loadOverview)

const pipelineHealth = ref([])
async function loadPipeline() {
  try {
    const resp = await fetch('/api/data-quality/pipeline')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    pipelineHealth.value = await resp.json()
  } catch { /* hub still renders without KPIs */ }
}
onMounted(loadPipeline)

// Aggregate per-source health onto the dashboard route each source maps
// to (e.g. gleif + gleif-relationships both land on /data-quality/gleif).
const RANK = { success: 0, running: 1, failed: 2 }
const healthByRoute = computed(() => {
  const map = {}
  for (const h of pipelineHealth.value) {
    if (!h.route) continue
    const m = map[h.route] || (map[h.route] = {
      events_total: 0, events_30d: 0, deadletter: 0,
      age_hours: null, stale: false, last_run_status: 'success',
    })
    m.events_total += h.events_total || 0
    m.events_30d += h.events_30d || 0
    m.deadletter += h.deadletter || 0
    m.stale = m.stale || h.stale
    if (h.age_hours != null) {
      m.age_hours = m.age_hours == null ? h.age_hours : Math.max(m.age_hours, h.age_hours)
    }
    if ((RANK[h.last_run_status] ?? 0) > (RANK[m.last_run_status] ?? 0)) {
      m.last_run_status = h.last_run_status
    }
  }
  for (const m of Object.values(map)) {
    m.deadletter_pct = m.events_total
      ? Math.round((m.deadletter / m.events_total) * 1000) / 10 : 0
  }
  return map
})
function tileHealth(id) { return healthByRoute.value[`/data-quality/${id}`] || null }

const THEME_LABEL = {
  procurement: 'Public Procurement', corporate: 'Corporate & Financials',
  securities: 'Securities & Instruments', influence: 'Influence & Accountability',
  geography: 'Geography', climate: 'Climate',
  analytical: 'Cross-source & Analytical',
}
const THEME_ORDER = ['procurement', 'corporate', 'securities', 'influence',
                     'geography', 'climate', 'analytical']
const groupedPipelines = computed(() => THEME_ORDER
  .map(t => ({ theme: t, label: THEME_LABEL[t], tiles: pipelines.filter(p => p.theme === t) }))
  .filter(g => g.tiles.length))


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
        <router-link to="/admin" class="dqh-back">{{ $t('nav.back_admin') }}</router-link>
        <h1>{{ $t('data_quality_hub.data_quality') }}</h1>
        <p class="dqh-sub">{{ $t('data_quality_hub.per_pipeline_dashboards_drill_into_each_etl') }}</p>
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

      <!-- Themes: the investigative entry, composed across sources. The
           per-source dashboards below remain the operational / health layer. -->
      <section class="dqh-themes" data-testid="dqh-themes">
        <h2 class="dqh-theme-title">{{ $t('data_quality_hub.themes') }}</h2>
        <div class="dqh-grid">
          <router-link
            v-for="t in themes"
            :key="t.id"
            :to="`/data-quality/theme/${t.id}`"
            class="dqh-card dqh-card--theme"
          >
            <div class="dqh-card-header">
              <span class="dqh-card-icon">{{ t.icon }}</span>
              <h3>{{ t.title }}</h3>
            </div>
            <p>{{ t.blurb }}</p>
          </router-link>
        </div>
      </section>

      <!-- Per-source dashboards, grouped by theme, each with live
           pipeline-health KPIs (freshness / volume / dead-letter). -->
      <section
        v-for="group in groupedPipelines"
        :key="group.theme"
        class="dqh-theme"
        :data-testid="`dqh-theme-${group.theme}`"
      >
        <h2 class="dqh-theme-title">{{ group.label }}</h2>
        <div class="dqh-grid">
          <router-link
            v-for="p in group.tiles"
            :key="p.id"
            :to="`/data-quality/${p.id}`"
            class="dqh-card"
            :class="{ 'dqh-card--featured': p.featured }"
          >
            <div class="dqh-card-header">
              <span class="dqh-card-icon">{{ p.icon }}</span>
              <h3>{{ p.title }}</h3>
              <span v-if="pipelineStat(p.id)" class="dqh-card-badge">{{ pipelineStat(p.id) }}</span>
            </div>
            <p>{{ p.desc }}</p>
            <SourceHealthBadge :health="tileHealth(p.id)" />
          </router-link>
        </div>
      </section>
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


.dqh-theme { margin-bottom: 1.75rem; }
.dqh-theme-title { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 0.6rem; padding-bottom: 0.3rem; border-bottom: 1px solid var(--border); }
.dqh-card h3 { font-size: 0.98rem; font-weight: 700; margin: 0; }
.dqh-card .shb { margin-top: 0.55rem; }

.dqh-themes { margin-bottom: 2rem; }
.dqh-card--theme { border-left: 3px solid var(--accent); }
</style>