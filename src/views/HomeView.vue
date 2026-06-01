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
    key: 'overview', label: 'Overview',
    views: [
      { key: 'profile', label: 'Profile' },
      { key: 'graph', label: 'Graph Explorer' },
    ],
  },
  {
    key: 'financials', label: 'Financials',
    views: [
      { key: 'summary',      label: 'Summary' },
      { key: 'fundamentals', label: 'Fundamentals' },
      { key: 'income',       label: 'Income' },
      { key: 'cashflow',     label: 'Cash Flow' },
      { key: 'balance',      label: 'Balance' },
      { key: 'valuation',    label: 'Valuation' },
    ],
  },
  {
    key: 'procurement', label: 'Procurement',
    views: [
      { key: 'contracts',       label: 'Contracts' },
      { key: 'entity-nuts-map', label: 'Business Map' },
    ],
  },
  // The "Analysis" group (formerly: Long-Term Value via /api/:ticker/gmr_data)
  // was removed from the profile UI on 2026-05-31 — the panel wasn't
  // pulling its weight against the Financials surfaces. The underlying
  // /api/:ticker/gmr_data endpoint and the `fetchGmrData()` client stay
  // in tree because at least one external embed consumes them.
]

const selectedTicker = computed(() => route.params.ticker || null)
const selectedView   = computed(() => route.params.view   || 'summary')

// Re-probe when the ticker changes (route param) — every new entity
// might have different data coverage.
watch(selectedTicker, (sym) => probeFinancials(sym), { immediate: true })

// Render-time view list with the disabled flag attached to the
// financials group. Other categories are always enabled — overview
// and procurement both gracefully handle "nothing found".
const computedViewGroups = computed(() => VIEW_GROUPS.map((g) => {
  if (g.key === 'financials' && hasFinancials.value === false) {
    return {
      ...g,
      disabled: true,
      disabledReason: 'No financial data available for this entity.',
    }
  }
  return g
}))

function onCompanyResolved(info) {
  if (info?.name) {
    const view = selectedView.value || 'summary'
    const label = view.charAt(0).toUpperCase() + view.slice(1)
    document.title = `${info.name} — ${label} | Fontem`
  }
}

const { track } = useAnalytics()

function onViewChange(view) {
  track('view-changed', { symbol: selectedTicker.value, view })
  router.push('/c/' + selectedTicker.value + '/' + view)
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
