<script setup>
import { ref, onMounted, computed } from 'vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import SourceHealthBadge from '../components/SourceHealthBadge.vue'
import { THEMES } from './themes/themeConfig.js'

onMounted(() => { document.title = 'Dashboards — Dargle' })

// The hub is a fast SELECTOR, not a dashboard. It used to block its whole
// render on GET /api/data-quality (a heavy cross-graph aggregate) just to
// paint an overview strip + per-tile count badges — which made the page
// crawl. That overview now lives on its own "Overview" dashboard
// (/data-quality/overview). Here we render the static grid immediately and
// only fetch the lightweight per-source health badges, asynchronously.
const pipelines = [
  { id: 'overview', title: 'data_quality_hub.overview', desc: 'data_quality_hub.overview_desc', icon: '📊', featured: true, theme: 'analytical'  },
  { id: 'connectedness', title: 'data_quality_hub.graph_connectedness', desc: 'data_quality_hub.connectedness_desc', icon: '🔗', theme: 'analytical'  },
  { id: 'triples', title: 'data_quality_hub.triple_store', desc: 'data_quality_hub.triples_desc', icon: '🧬', theme: 'analytical'  },
  { id: 'contracts', title: 'data_quality_hub.ted_contracts', desc: 'data_quality_hub.contracts_desc', icon: '📄', theme: 'procurement'  },
  { id: 'gleif', title: 'data_quality_hub.gleif_companies', desc: 'data_quality_hub.gleif_desc', icon: '🏢', theme: 'corporate'  },
  { id: 'edgar', title: 'data_quality_hub.us_edgar', desc: 'data_quality_hub.edgar_desc', icon: '📊', theme: 'corporate'  },
  { id: 'esef', title: 'data_quality_hub.eu_esef', desc: 'data_quality_hub.esef_desc', icon: '📈', theme: 'corporate'  },
  { id: 'lobbying', title: 'data_quality_hub.eu_lobbying', desc: 'data_quality_hub.lobbying_desc', icon: '🏛', theme: 'influence'  },
  { id: 'trade-edges', title: 'data_quality_hub.trade_edges', desc: 'data_quality_hub.trade_edges_desc', icon: '🔗', theme: 'analytical'  },
  { id: 'dedup', title: 'data_quality_hub.deduplication', desc: 'data_quality_hub.dedup_desc', icon: '🔍', theme: 'analytical'  },
  { id: 'sanctions', title: 'data_quality_hub.sanctions', desc: 'data_quality_hub.sanctions_desc', icon: '🚫', theme: 'influence'  },
  { id: 'firds', title: 'data_quality_hub.firds_instruments', desc: 'data_quality_hub.firds_desc', icon: '📋', theme: 'securities'  },
  { id: 'openfigi', title: 'data_quality_hub.openfigi_and_funds', desc: 'data_quality_hub.openfigi_desc', icon: '🏦', theme: 'securities'  },
  { id: 'prices', title: 'data_quality_hub.stock_prices', desc: 'data_quality_hub.prices_desc', icon: '📈', theme: 'securities'  },
  { id: 'cdp', title: 'data_quality_hub.cdp_climate', desc: 'data_quality_hub.cdp_desc', icon: '🌍', theme: 'climate'  },
  { id: 'nuts', title: 'data_quality_hub.nuts_regions', desc: 'data_quality_hub.nuts_desc', icon: '🗺', theme: 'geography'  },
  { id: 'eu-knowledge-graph', title: 'data_quality_hub.eu_knowledge_graph', desc: 'data_quality_hub.eu_kg_desc', icon: '🇪🇺', theme: 'influence'  },
  { id: 'assertions', title: 'data_quality_hub.assertion_monitor', desc: 'data_quality_hub.assertions_desc', icon: '✅', featured: true, theme: 'analytical'  },
  { id: 'legislative', title: 'data_quality_hub.eu_legislation', desc: 'data_quality_hub.legislative_desc', icon: '⚖️', theme: 'influence'  },
  { id: 'etl-runs', title: 'data_quality_hub.etl_runs', desc: 'data_quality_hub.etl_runs_desc', icon: '⏱', theme: 'analytical'  },
]

const themes = THEMES

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
  procurement: 'data_quality_hub.theme_procurement',
  corporate: 'data_quality_hub.theme_corporate',
  securities: 'data_quality_hub.theme_securities',
  influence: 'data_quality_hub.theme_influence',
  geography: 'data_quality_hub.theme_geography',
  climate: 'data_quality_hub.theme_climate',
  analytical: 'data_quality_hub.theme_analytical',
}
const THEME_ORDER = ['procurement', 'corporate', 'securities', 'influence',
                     'geography', 'climate', 'analytical']
const groupedPipelines = computed(() => THEME_ORDER
  .map(t => ({ theme: t, label: THEME_LABEL[t], tiles: pipelines.filter(p => p.theme === t) }))
  .filter(g => g.tiles.length))
</script>

<template>
  <div class="dqh">
    <header class="dqh-header">
      <div>
        <h1>{{ $t('data_quality_hub.dashboards') }}</h1>
        <p class="dqh-sub">{{ $t('data_quality_hub.dashboards_sub') }}</p>
      </div>
      <ThemeToggle />
    </header>

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
            <h3>{{ $t(t.title) }}</h3>
          </div>
          <p>{{ $t(t.blurb) }}</p>
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
      <h2 class="dqh-theme-title">{{ $t(group.label) }}</h2>
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
            <h3>{{ $t(p.title) }}</h3>
          </div>
          <p>{{ $t(p.desc) }}</p>
          <SourceHealthBadge :health="tileHealth(p.id)" />
        </router-link>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dqh { max-width: 960px; margin: 0 auto; padding: 0 1rem 4rem; }
.dqh-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 0 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.dqh-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0.3rem 0 0; }
.dqh-sub { font-size: 0.85rem; color: var(--muted); margin-top: 0.2rem; }

.dqh-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
.dqh-card { display: block; padding: 1.25rem; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: inherit; transition: border-color 0.15s; }
.dqh-card:hover { border-color: var(--accent); }
.dqh-card-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
.dqh-card-icon { font-size: 1.2rem; }
.dqh-card h2 { font-size: 1rem; font-weight: 700; color: var(--accent); margin: 0; flex: 1; }
.dqh-card p { font-size: 0.82rem; color: var(--muted); margin: 0; line-height: 1.4; }
.dqh-card--featured { grid-column: 1 / -1; border-color: var(--accent); border-width: 2px; }

.dqh-theme { margin-bottom: 1.75rem; }
.dqh-theme-title { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 0.6rem; padding-bottom: 0.3rem; border-bottom: 1px solid var(--border); }
.dqh-card h3 { font-size: 0.98rem; font-weight: 700; margin: 0; }
.dqh-card .shb { margin-top: 0.55rem; }

.dqh-themes { margin-bottom: 2rem; }
.dqh-card--theme { border-left: 3px solid var(--accent); }
</style>
