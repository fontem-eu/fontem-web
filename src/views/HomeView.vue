<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TickerSearch from '../components/TickerSearch.vue'
import TickerFinancials from '../components/TickerFinancials.vue'
import DataViewSelector from '../components/DataViewSelector.vue'
import ThemeToggle from '../components/ThemeToggle.vue'

const route = useRoute()
const router = useRouter()

const VIEWS = [
  { key: 'fundamentals', label: 'Fundamentals' },
  { key: 'gmr-long', label: 'GMR Long' },
]

const features = [
  {
    title: 'Fundamentals',
    body: 'Revenue, net income, gross & operating margins, ROE, ROA — annual breakdowns straight from 10-K filings.',
  },
  {
    title: 'Cash Flow',
    body: 'Operating cashflow, capital expenditure, and free cash flow per year. See whether profits turn into cash.',
  },
  {
    title: 'GMR Long',
    body: 'Balance sheet over time: assets, liabilities, equity, debt, and quick ratio to gauge long-run financial health.',
  },
]

const popular = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'JPM']

const selectedTicker = computed(() => route.params.ticker || null)
const selectedView = computed(() => route.params.view || 'fundamentals')

function onTickerSelect(symbol) {
  router.push('/' + symbol + '/' + selectedView.value)
}

function onViewChange(view) {
  router.push('/' + selectedTicker.value + '/' + view)
}

function onClose() {
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen" style="background: var(--bg)">
    <!-- ── Banner ─────────────────────────────────────────── -->
    <header class="border-b" style="border-color: var(--border)">
      <div class="mx-auto flex w-full max-w-6xl items-center gap-6 px-6 py-4">
        <!-- Logo -->
        <div class="shrink-0">
          <h1 class="text-xl font-bold leading-none tracking-tight">
            <span style="color: var(--accent)">GMR</span>
            <span style="color: var(--text)"> Ticker Search</span>
          </h1>
          <p class="mt-1 text-xs font-medium uppercase tracking-widest" style="color: var(--muted)">
            10,000+ companies &middot; SEC EDGAR
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
    <div class="mx-auto w-full px-6" :class="selectedTicker ? 'max-w-6xl' : 'max-w-xl'">
      <main>
        <!-- ── Landing ──────────────────────────────────────── -->
        <div v-if="!selectedTicker" class="mt-14 space-y-10 pb-16">
          <!-- Hero -->
          <div class="space-y-2 text-center">
            <p class="text-2xl font-bold tracking-tight" style="color: var(--text)">
              Financials, straight from the source.
            </p>
            <p class="text-sm leading-relaxed" style="color: var(--muted)">
              Raw SEC EDGAR filings parsed and presented clearly.<br />No noise. No opinion. Just
              data.
            </p>
          </div>

          <!-- Feature cards -->
          <div class="grid grid-cols-3 gap-3">
            <div
              v-for="f in features"
              :key="f.title"
              class="border p-4"
              style="border-color: var(--border); background: var(--surface)"
            >
              <div
                class="mb-2 text-xs font-bold uppercase tracking-widest"
                style="color: var(--accent)"
              >
                {{ f.title }}
              </div>
              <div class="text-xs leading-relaxed" style="color: var(--muted)">{{ f.body }}</div>
            </div>
          </div>

          <!-- Popular tickers -->
          <div>
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
                style="
                  border-color: var(--border);
                  background: var(--surface);
                  color: var(--text);
                "
                @click="onTickerSelect(t)"
                @mouseover="$event.currentTarget.style.borderColor = 'var(--accent)'"
                @mouseleave="$event.currentTarget.style.borderColor = 'var(--border)'"
              >
                {{ t }}
              </button>
            </div>
          </div>

          <!-- Disclaimer -->
          <div class="border-l-2 pl-4" style="border-color: var(--border)">
            <p
              class="mb-1 text-xs font-bold uppercase tracking-widest"
              style="color: var(--muted)"
            >
              Invest with care
            </p>
            <p class="text-xs leading-relaxed" style="color: var(--muted)">
              Markets are uncertain and past performance is no guarantee of future results. This
              platform provides raw financial data for informational purposes only — not investment
              advice. Do your own research, diversify broadly, and never invest more than you can
              afford to lose.
            </p>
          </div>
        </div>

        <!-- ── Ticker detail ─────────────────────────────────── -->
        <div v-if="selectedTicker" class="mt-6 flex items-start gap-4">
          <DataViewSelector
            :model-value="selectedView"
            :views="VIEWS"
            @update:model-value="onViewChange"
          />
          <TickerFinancials
            :symbol="selectedTicker"
            :view="selectedView"
            class="min-w-0 flex-1"
            @close="onClose"
          />
        </div>
      </main>

      <!-- ── Footer ──────────────────────────────────────── -->
      <footer class="pb-10 pt-12">
        <p class="text-xs tracking-wide" style="color: var(--muted)">Data sourced from SEC EDGAR</p>
      </footer>
    </div>
  </div>
</template>
