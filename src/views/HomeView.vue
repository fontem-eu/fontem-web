<script setup>
/**
 * Ticker-detail host. Mounted at `/c/:ticker/:view` only — the
 * old `/` mounting moved to FeedView once the IA changed (Stories
 * landing, About link in the footer for the marketing copy).
 *
 * Deliberately kept as `HomeView` to avoid renaming churn; the
 * file is the financials/profile shell for a single ticker.
 */
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TickerFinancials from '../components/TickerFinancials.vue'
import DataViewSelector from '../components/DataViewSelector.vue'
import { fetchFundamentals } from '../api/gmr.js'
import { useAnalytics } from '../composables/useAnalytics.js'

const route = useRoute()
const router = useRouter()

// Whether this entity has any financial data to surface in the tab
// strip. `null` while we probe; `true|false` after.
// Probed via a one-shot fetchFundamentals call against the current
// ticker/UUID. Authorities and unlisted companies return empty here,
// so we grey out the Financials category until the user picks
// another entity. Probe failures are treated as "no data" — better
// to grey a tab the user can't use than to show it and have them
// click into an error state.
const hasFinancials = ref(null)
const entityKind = ref(null)

let _probeId = 0
async function probeFinancials(sym) {
  if (!sym) return
  const id = ++_probeId
  hasFinancials.value = null
  try {
    const fund = await fetchFundamentals(sym, 1)
    if (_probeId !== id) return
    const annual = fund?.annual_data || fund?.per_year || []
    const hasNumbers = annual.some(
      (r) => r?.revenue != null || r?.net_income != null || r?.earnings != null,
    )
    hasFinancials.value = Boolean(
      hasNumbers || fund?.market_snapshot?.market_cap != null,
    )
  } catch {
    if (_probeId === id) hasFinancials.value = false
  }
}

const VIEW_GROUPS = [
  {
    key: 'overview', label: 'home.overview',
    views: [
      { key: 'profile', label: 'home.profile' },
      { key: 'graph', label: 'home.graph_explorer' },
    ],
  },
  {
    key: 'financials', label: 'home.financials',
    views: [
      { key: 'summary',      label: 'home.summary' },
      { key: 'fundamentals', label: 'home.fundamentals' },
      { key: 'income',       label: 'home.income' },
      { key: 'cashflow',     label: 'home.cash_flow' },
      { key: 'balance',      label: 'home.balance' },
      { key: 'valuation',    label: 'home.valuation' },
    ],
  },
  {
    key: 'procurement', label: 'home.procurement',
    views: [
      { key: 'contracts',       label: 'home.contracts' },
      { key: 'entity-nuts-map', label: 'home.business_map' },
    ],
  },
  // The "Analysis" group (formerly: Long-Term Value via /api/:ticker/gmr_data)
  // was removed from the profile UI on 2026-05-31 — the panel wasn't
  // pulling its weight against the Financials surfaces. The underlying
  // /api/:ticker/gmr_data endpoint and the `fetchGmrData()` client stay
  // in tree because at least one external embed consumes them.
]

// One host, three URLs. `/c/:ticker` is the historical ticker route;
// `/company/:gmr_id` and `/authority/:authority_id` are the semantic
// entity URLs the search results and the sitemap use. They all resolve
// the same entity — TickerFinancials already accepts a UUID and probes
// companies then authorities — so they render the same shell rather
// than each growing their own thinner copy, which is how this page
// became unreachable from search in the first place.
const selectedTicker = computed(() =>
  route.params.ticker || route.params.gmr_id || route.params.authority_id || null)

// Ticker URLs keep their historical 'summary' default. The semantic
// entity URLs open on 'profile' — the overview of everything known
// about the entity, which is what someone clicking a search result is
// asking for.
const selectedView = computed(
  () => route.params.view || (route.params.ticker ? 'summary' : 'profile'))

/** The URL family this page was entered through, so tabs stay on it. */
function basePath() {
  if (route.params.gmr_id) return `/company/${route.params.gmr_id}`
  if (route.params.authority_id) return `/authority/${route.params.authority_id}`
  return `/c/${selectedTicker.value}`
}

// Re-probe when the ticker changes (route param) — every new entity
// might have different data coverage. Also wipe entityKind so we
// don't carry the previous entity's classification into the new
// resolver round-trip; TickerFinancials will re-emit `company-resolved`
// with the fresh value as soon as the new entity resolves.
watch(selectedTicker, (sym) => {
  entityKind.value = null
  probeFinancials(sym)
}, { immediate: true })

// If the user landed on an authority profile while the URL pointed at
// a Financials view (e.g. summary), bounce to Profile — the Financials
// group is hidden so the selected view would otherwise be orphaned.
const FINANCIAL_VIEW_KEYS = new Set(['summary', 'fundamentals', 'income', 'cashflow', 'balance', 'valuation'])
watch(entityKind, (kind) => {
  if (kind === 'authority' && FINANCIAL_VIEW_KEYS.has(selectedView.value)) {
    router.replace(`/c/${selectedTicker.value}/profile`)
  }
})

// Render-time view list. Two layers of filtering:
//   1. For authorities, drop the Financials group entirely — the
//      user reported it's just dead UI on an authority profile.
//      Equivalent to a hard-coded "no financials" decision; we don't
//      need to probe the API for these entities.
//   2. For companies whose probe returned no data, keep the group
//      visible but grey it out with a tooltip — different signal
//      ("nothing yet" vs "doesn't apply").
const computedViewGroups = computed(() => VIEW_GROUPS.flatMap((g) => {
  if (g.key === 'financials' && entityKind.value === 'authority') {
    return []
  }
  if (g.key === 'financials' && hasFinancials.value === false) {
    return [{
      ...g,
      disabled: true,
      disabledReason: 'No financial data available for this entity.',
    }]
  }
  return [g]
}))

function onCompanyResolved(info) {
  if (info?.kind === 'company' || info?.kind === 'authority') {
    entityKind.value = info.kind
  }
  if (info?.name) {
    const view = selectedView.value || 'summary'
    const label = view.charAt(0).toUpperCase() + view.slice(1)
    document.title = `${info.name} — ${label} | Fontem`
  }
}

const { track } = useAnalytics()

function onViewChange(view) {
  track('view-changed', { symbol: selectedTicker.value, view })
  // Keep the URL family: switching tabs on /company/<id> must not
  // bounce the reader onto /c/<id>, which is the same page under a
  // less meaningful address.
  router.push(`${basePath()}/${view}`)
}

function onClose() {
  document.title = 'Fontem — EU Enterprise Knowledge Graph'
  router.push('/')
}
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 sm:px-6">
    <main>
      <div
        v-if="selectedTicker"
        class="mt-6 flex flex-col gap-0 sm:flex-row sm:items-start sm:gap-4"
        data-testid="ticker-detail"
      >
        <DataViewSelector
          :model-value="selectedView"
          :groups="computedViewGroups"
          @update:model-value="onViewChange"
        />
        <TickerFinancials
          :symbol="selectedTicker"
          :view="selectedView"
          class="min-w-0 flex-1"
          @close="onClose"
          @company-resolved="onCompanyResolved"
        />
      </div>
    </main>
  </div>
</template>
