<script setup>
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TickerSearch from '../components/TickerSearch.vue'
import TickerFinancials from '../components/TickerFinancials.vue'
import DataViewSelector from '../components/DataViewSelector.vue'
import { useAnalytics } from '../composables/useAnalytics.js'

const route = useRoute()
const router = useRouter()

const hasToken = computed(() => !!localStorage.getItem('gmr-token'))

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

const features = [
  {
    title: 'Company Profile',
    body: 'Financial overview, EU public procurement contracts, directors and officers — all in one view.',
  },
  {
    title: 'Contracts',
    body: 'Sortable table of EU public procurement awards with values, authorities, CPV sectors, and TED links.',
  },
  {
    title: 'Fundamentals',
    body: 'Revenue, margins, FCF, leverage — up to 10 years of data from SEC EDGAR and ESMA ESEF filings.',
  },
  {
    title: 'Directors',
    body: 'Company officers and board members sourced from French and EU business registers.',
  },
  {
    title: 'Corporate Groups',
    body: 'Parent-subsidiary relationships from GLEIF. See how companies connect across countries.',
  },
  {
    title: 'Data Quality',
    body: 'Transparent metrics: entity resolution stats, data freshness, country coverage, source traceability.',
  },
]

const popular = ['AAPL', 'ASML.AS', 'SAP.DE', 'GALP.LS', 'MSFT', 'NVDA', 'TSLA', 'GOOGL']

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
  <div class="mx-auto w-full px-4 sm:px-6" :class="selectedTicker ? 'max-w-6xl' : 'max-w-2xl'">
    <main>
      <!-- ── Landing ──────────────────────────────────────── -->
      <div v-if="!selectedTicker" class="mt-8 pb-12 sm:mt-14 sm:pb-16">

        <!-- Hero -->
        <div class="mb-5 space-y-2 text-center sm:mb-10">
          <p class="text-2xl font-bold tracking-tight" style="color: var(--text)">
            EU Enterprise Knowledge Graph
          </p>
          <p class="hidden text-sm leading-relaxed sm:block" style="color: var(--muted)">
            Companies, financials, EU public procurement contracts, directors, and
            corporate group structures — all traceable to official sources.
          </p>
          <p class="text-sm sm:hidden" style="color: var(--muted)">
            Companies · Contracts · Directors · Financials
          </p>
        </div>

        <!-- ── Two main paths ─────────────────────────────── -->
        <div class="mb-8 grid gap-4 sm:grid-cols-2 sm:mb-12" data-testid="landing-paths">
          <!-- Path 1: Search the graph -->
          <div
            class="path-card"
            data-testid="path-graph"
            @click="$refs.graphSearchInput?.focus()"
          >
            <div class="path-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div class="path-label">Search the Graph</div>
            <p class="path-desc">
              Look up any company, authority, or person. Explore financials, contracts, directors, and corporate structures.
            </p>
            <div class="mt-3">
              <TickerSearch
                ref="graphSearchInput"
                :selected-symbol="selectedTicker"
                :compact="true"
                @select="onTickerSelect"
              />
            </div>
          </div>

          <!-- Path 2: Explore reports -->
          <router-link
            to="/reports"
            class="path-card"
            data-testid="path-reports"
            style="text-decoration: none"
          >
            <div class="path-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div class="path-label">Reports &amp; Analysis</div>
            <p class="path-desc">
              Browse community investigations, collaborative reports, and data-driven analysis by researchers and journalists.
            </p>
            <span class="path-link">Browse reports &rarr;</span>
          </router-link>
        </div>

        <!-- Sign-in CTA for anonymous users -->
        <div v-if="!hasToken" class="mb-8 text-center sm:mb-12" data-testid="anon-cta">
          <p class="text-sm" style="color: var(--muted)">
            Sign in to create reports, raise issues, and collaborate with the community.
          </p>
          <router-link
            to="/login"
            class="inline-block mt-2 px-4 py-2 text-sm font-semibold rounded"
            style="background: var(--accent); color: #fff; text-decoration: none"
          >
            Sign in to get started
          </router-link>
        </div>

        <!-- Recently viewed -->
        <div v-if="recentCompanies.length" class="mb-5 sm:mb-8" data-testid="recent-tickers">
          <p
            class="mb-3 text-xs font-semibold uppercase tracking-widest"
            style="color: var(--muted)"
          >
            Recently viewed
          </p>
          <div class="flex flex-wrap gap-2">
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

        <!-- Popular tickers -->
        <div class="mb-6 sm:mb-10">
          <p
            class="mb-3 text-xs font-semibold uppercase tracking-widest"
            style="color: var(--muted)"
          >
            Popular
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="t in popular"
              :key="t"
              class="border px-3 py-1 text-xs font-semibold tracking-wide transition-colors duration-150"
              style="border-color: var(--border); background: var(--surface); color: var(--text)"
              @click="onTickerSelect(t)"
              @mouseover="$event.currentTarget.style.borderColor = 'var(--accent)'"
              @mouseleave="$event.currentTarget.style.borderColor = 'var(--border)'"
            >
              {{ t }}
            </button>
          </div>
        </div>

        <!-- Feature cards — desktop only -->
        <div
          class="mb-10 hidden gap-3 sm:grid sm:grid-cols-3"
          data-testid="features-grid"
        >
          <div
            v-for="f in features"
            :key="f.title"
            class="border p-4"
            style="border-color: var(--border); background: var(--surface)"
          >
            <div class="mb-2 text-xs font-bold uppercase tracking-widest" style="color: var(--accent)">
              {{ f.title }}
            </div>
            <div class="text-xs leading-relaxed" style="color: var(--muted)">{{ f.body }}</div>
          </div>
        </div>

        <!-- Disclaimer -->
        <div class="hidden border-l-2 pl-4 sm:block" style="border-color: var(--border)">
          <p class="mb-1 text-xs font-bold uppercase tracking-widest" style="color: var(--muted)">
            Invest with care
          </p>
          <p class="text-xs leading-relaxed" style="color: var(--muted)">
            Markets are uncertain and past performance is no guarantee of future results. This
            platform provides raw financial data for informational purposes only — not investment
            advice. Do your own research, diversify broadly, and never invest more than you can
            afford to lose.
          </p>
        </div>
        <p class="text-xs sm:hidden" style="color: var(--muted)">
          For informational use only. Not investment advice.
        </p>
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
.path-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
}
.path-card:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
.path-icon {
  color: var(--accent);
  margin-bottom: 0.75rem;
}
.path-label {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.35rem;
}
.path-desc {
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--muted);
  margin: 0;
}
.path-link {
  margin-top: auto;
  padding-top: 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent);
}
</style>
