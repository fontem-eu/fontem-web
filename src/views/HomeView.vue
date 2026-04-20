<script setup>
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TickerSearch from '../components/TickerSearch.vue'
import TickerFinancials from '../components/TickerFinancials.vue'
import DataViewSelector from '../components/DataViewSelector.vue'
import { useAnalytics } from '../composables/useAnalytics.js'

const route = useRoute()
const router = useRouter()

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
  {
    key: 'analysis', label: 'Analysis',
    views: [{ key: 'gmr-long', label: 'GMR Long' }],
  },
]

const selectedTicker = computed(() => route.params.ticker || null)
const selectedView = computed(() => route.params.view || 'summary')

// ── Recent companies (localStorage) ──────────────────────────
// Stores {id, name} objects instead of raw ticker strings
const RECENT_KEY = 'gmr-recent-companies'
const MAX_RECENT = 5

function loadRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    // Migrate old format (plain strings) to new format (objects)
    return raw.map((item) => {
      if (typeof item === 'string') return { id: item, name: item }
      return item
    })
  } catch { return [] }
}

const recentCompanies = ref(loadRecent())

function saveRecent(id, name) {
  const displayName = name || id
  const entry = { id, name: displayName }
  const updated = [entry, ...recentCompanies.value.filter((e) => e.id !== id)].slice(0, MAX_RECENT)
  recentCompanies.value = updated
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)) } catch { /* ignore */ }
}

// Update recent + page title when TickerFinancials resolves company name
function onCompanyResolved(info) {
  if (info?.id) saveRecent(info.id, info.name)
  if (info?.name) {
    const view = selectedView.value || 'summary'
    const label = view.charAt(0).toUpperCase() + view.slice(1)
    document.title = `${info.name} — ${label} | GMR`
  }
}

const { track } = useAnalytics()

function onTickerSelect(symbol) {
  track('ticker-selected', { symbol })
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(symbol)
  const view = isUuid ? 'profile' : selectedView.value
  router.push('/c/' + symbol + '/' + view)
}

function onViewChange(view) {
  track('view-changed', { symbol: selectedTicker.value, view })
  router.push('/c/' + selectedTicker.value + '/' + view)
}

function onClose() {
  document.title = 'GMR — EU Enterprise Knowledge Graph'
  router.push('/')
}
</script>

<template>
  <div class="mx-auto w-full px-4 sm:px-6" :class="selectedTicker ? 'max-w-6xl' : 'max-w-xl'">
    <main>
      <!-- ── Landing: centered search card ──────────────────── -->
      <div v-if="!selectedTicker" class="landing" data-testid="landing">
        <div class="landing-card">
          <div class="landing-logo">
            <span class="logo-accent">GMR</span>
          </div>
          <TickerSearch
            ref="graphSearchInput"
            :selected-symbol="null"
            :compact="true"
            class="landing-search"
            @select="onTickerSelect"
          />
          <p class="landing-hint">
            Search companies, public entities, lobbyists and more…
          </p>
        </div>

        <div v-if="recentCompanies.length" class="mt-6 text-center" data-testid="recent-tickers">
          <p class="mb-2 text-xs font-semibold uppercase tracking-widest" style="color: var(--muted)">
            Recently viewed
          </p>
          <div class="flex flex-wrap justify-center gap-2">
            <button
              v-for="entry in recentCompanies"
              :key="entry.id"
              class="border px-3 py-1 text-xs font-semibold tracking-wide transition-colors duration-150"
              style="border-color: var(--accent); background: var(--surface); color: var(--accent)"
              @click="onTickerSelect(entry.id)"
            >
              {{ entry.name }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── Ticker detail ─────────────────────────────────── -->
      <div v-if="selectedTicker" class="mt-6 flex flex-col gap-0 sm:flex-row sm:items-start sm:gap-4" data-testid="ticker-detail">
        <DataViewSelector
          :model-value="selectedView"
          :groups="VIEW_GROUPS"
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

    <!-- ── Footer ──────────────────────────────────────── -->
    <footer class="pb-10 pt-12">
      <p class="text-xs tracking-wide" style="color: var(--muted)">
        Data sourced from SEC EDGAR, ESMA ESEF, GLEIF &amp; TED (EU Procurement)
        &nbsp;&middot;&nbsp;
        <router-link to="/admin" style="color: var(--accent)">Admin</router-link>
      </p>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  min-height: calc(100vh - 8rem);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  padding: 2rem 0;
}
.landing-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 2rem 1.5rem;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.landing-logo {
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 1.25rem;
  line-height: 1;
}
.landing-logo .logo-accent { color: var(--accent); }
.landing-search {
  display: block;
  margin: 0 auto;
  max-width: 26rem;
}
.landing-hint {
  margin: 0.85rem 0 0;
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.4;
}
@media (min-width: 640px) {
  .landing-card { padding: 2.5rem 2rem; }
  .landing-logo { font-size: 2.75rem; }
}
</style>
