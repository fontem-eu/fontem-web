<script setup>
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TickerSearch from '../components/TickerSearch.vue'
import TickerFinancials from '../components/TickerFinancials.vue'
import DataViewSelector from '../components/DataViewSelector.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import { useAnalytics } from '../composables/useAnalytics.js'

const route = useRoute()
const router = useRouter()

const ALL_VIEWS = [
  { key: 'summary',      label: 'Summary'      },
  { key: 'fundamentals', label: 'Fundamentals' },
  { key: 'income',       label: 'Income'       },
  { key: 'cashflow',     label: 'Cash Flow'    },
  { key: 'balance',      label: 'Balance'      },
  { key: 'valuation',    label: 'Valuation'    },
  { key: 'contracts',    label: 'Contracts'    },
  { key: 'gmr-long',     label: 'GMR Long'     },
]

const activeViews = computed(() => ALL_VIEWS)

const features = [
  {
    title: 'Summary',
    body: 'Interactive price chart with crosshair, 52-week range, market cap, beta, and dividend yield.',
  },
  {
    title: 'Income',
    body: 'Revenue, net income, EPS, and gross/operating/net margins — up to 10 years of 10-K filings.',
  },
  {
    title: 'Cash Flow',
    body: 'Operating cashflow, free cash flow, and CapEx by year. See whether earnings turn into cash.',
  },
  {
    title: 'Balance Sheet',
    body: 'Assets, liabilities, equity, current ratio, D/E, ROE, and ROA across a decade.',
  },
  {
    title: 'Valuation',
    body: 'EV/EBITDA, EV/Revenue, P/E, ROIC, and WACC trends — historical multiples to gauge market pricing.',
  },
  {
    title: 'Fundamentals',
    body: 'A focused snapshot: key revenue, margin, FCF, and leverage figures all in one table.',
  },
]

const popular = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'JPM']

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
  // For procurement-only entities (UUID nav keys), default to contracts view
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(symbol)
  const view = isUuid ? 'contracts' : selectedView.value
  router.push('/' + symbol + '/' + view)
}

function onViewChange(view) {
  track('view-changed', { symbol: selectedTicker.value, view })
  router.push('/' + selectedTicker.value + '/' + view)
}

function onClose() {
  document.title = 'GMR — EU Enterprise Knowledge Graph'
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen" style="background: var(--bg)">
    <!-- ── Banner ─────────────────────────────────────────── -->
    <header class="border-b" style="border-color: var(--border)">
      <div class="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6 sm:py-4">
        <!-- Logo -->
        <div class="shrink-0" style="cursor: pointer" @click="router.push('/')">
          <h1 class="text-xl font-bold leading-none tracking-tight">
            <span style="color: var(--accent)">GMR</span>
            <span class="hidden sm:inline" style="color: var(--text)"> Ticker Search</span>
          </h1>
          <p class="mt-1 hidden text-xs font-medium uppercase tracking-widest sm:block" style="color: var(--muted)">
            10,000+ companies &middot; SEC EDGAR &middot; ESEF
          </p>
        </div>

        <!-- Search bar — fills remaining space -->
        <div class="flex-1">
          <TickerSearch :selected-symbol="selectedTicker" :compact="true" @select="onTickerSelect" />
        </div>

        <!-- Right controls -->
        <ThemeToggle />
      </div>
    </header>

    <!-- ── Content ────────────────────────────────────────── -->
    <div class="mx-auto w-full px-4 sm:px-6" :class="selectedTicker ? 'max-w-6xl' : 'max-w-xl'">
      <main>
        <!-- ── Landing ──────────────────────────────────────── -->
        <div v-if="!selectedTicker" class="mt-8 pb-12 sm:mt-14 sm:pb-16">

          <!-- Hero -->
          <div class="mb-5 space-y-2 text-center sm:mb-10">
            <p class="text-2xl font-bold tracking-tight" style="color: var(--text)">
              Financials, straight from the source.
            </p>
            <!-- Desktop: full context -->
            <p class="hidden text-sm leading-relaxed sm:block" style="color: var(--muted)">
              SEC EDGAR data across 10,000+ US-listed companies — price history, income,
              cash flow, balance sheet, and valuation. No noise. Just data.
            </p>
            <!-- Mobile: one compact line -->
            <p class="text-sm sm:hidden" style="color: var(--muted)">
              10,000+ companies · 6 financial views · SEC EDGAR
            </p>
          </div>

          <!-- How it works — 3-step strip -->
          <div class="mb-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs sm:mb-10">
            <span class="font-semibold" style="color: var(--text)">Search a ticker</span>
            <span style="color: var(--muted)">›</span>
            <span class="font-semibold" style="color: var(--text)">pick a view</span>
            <span style="color: var(--muted)">›</span>
            <span class="font-semibold" style="color: var(--text)">explore up to 10 years of data</span>
          </div>

          <!-- Recently viewed — only shown when history exists -->
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

          <!-- Popular tickers — prominent on all screen sizes -->
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

          <!-- Feature cards — desktop only (hidden on mobile to keep it compact) -->
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
          <!-- Desktop: full text -->
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
          <!-- Mobile: single line -->
          <p class="text-xs sm:hidden" style="color: var(--muted)">
            For informational use only. Not investment advice.
          </p>
        </div>

        <!-- ── Ticker detail ─────────────────────────────────── -->
        <div v-if="selectedTicker" class="mt-6 flex flex-col gap-0 sm:flex-row sm:items-start sm:gap-4" data-testid="ticker-detail">
          <DataViewSelector
            :model-value="selectedView"
            :views="activeViews"
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
          <router-link to="/data-quality" style="color: var(--accent)">Data Quality Dashboard</router-link>
        </p>
      </footer>
    </div>
  </div>
</template>
