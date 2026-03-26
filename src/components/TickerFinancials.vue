<script setup>
import { ref, watch, computed } from 'vue'
import { fetchGmrData, fetchFundamentals, fetchValuation } from '../api/gmr.js'
import { fmtMoney, fmtPrice } from '../utils/format.js'
import SummaryPanel from './SummaryPanel.vue'
import ValuationPanel from './ValuationPanel.vue'
import IncomePanel from './IncomePanel.vue'
import CashflowPanel from './CashflowPanel.vue'
import BalancePanel from './BalancePanel.vue'

const props = defineProps({
  symbol: { type: String, required: true },
  view: { type: String, default: 'fundamentals' }, // 'fundamentals' | 'gmr-long' | 'valuation' | 'summary'
})

const emit = defineEmits(['close'])

// ── Copy link ────────────────────────────────────────────────
const linkCopied = ref(false)
let _copyTimer = null
function copyLink() {
  navigator.clipboard?.writeText(window.location.href).then(() => {
    linkCopied.value = true
    clearTimeout(_copyTimer)
    _copyTimer = setTimeout(() => { linkCopied.value = false }, 1800)
  })
}

// EU tickers follow SYMBOL.EXCHANGE pattern (e.g. ASML.AS, SAP.DE)
const isEu = computed(() => /^[A-Z0-9]+\.[A-Z]{1,3}$/i.test(props.symbol))
const dataSource = computed(() => isEu.value ? 'esef' : 'edgar')

const data = ref(null)
const state = ref('loading') // 'loading' | 'done' | 'error' | 'timeout'
const displayYears = ref(10)

const YEAR_OPTIONS = [
  { value: 5,        label: '5Y',  testid: '5'   },
  { value: 7,        label: '7Y',  testid: '7'   },
  { value: 10,       label: '10Y', testid: '10'  },
  { value: Infinity, label: 'All', testid: 'all' },
]

let _loadId = 0

async function loadData(sym) {
  const id = ++_loadId
  data.value = null
  state.value = 'loading'

  // 15-second timeout: if API takes too long, surface a retry option.
  const timeout = setTimeout(() => {
    if (_loadId === id) state.value = 'timeout'
  }, 15000)

  try {
    let result
    if (props.view === 'gmr-long') {
      result = await fetchGmrData(sym)
    } else if (props.view === 'valuation') {
      result = await fetchValuation(sym)
    } else if (['fundamentals', 'income', 'cashflow', 'balance'].includes(props.view)) {
      result = await fetchFundamentals(sym)
    }
    if (_loadId !== id) return // stale response
    data.value = result ?? null
    state.value = 'done'
  } catch {
    if (_loadId !== id) return
    state.value = 'error'
  } finally {
    clearTimeout(timeout)
  }
}

watch(
  () => [props.symbol, props.view],
  ([sym]) => {
    if (!sym) return
    // Summary view manages its own data/state internally via SummaryPanel.
    if (props.view === 'summary') {
      state.value = 'done'
      data.value = null
      return
    }
    loadData(sym)
  },
  { immediate: true }
)

const viewLabel = computed(() => {
  if (props.view === 'gmr-long')  return 'Financial Overview'
  if (props.view === 'valuation') return 'Enterprise Valuation'
  if (props.view === 'summary')   return 'Price Summary'
  if (props.view === 'income')    return 'Income & Growth'
  if (props.view === 'cashflow')  return 'Cash Flow'
  if (props.view === 'balance')   return 'Balance Sheet'
  return 'Fundamentals'
})

// Most recent fiscal year with actual financial data (not just price).
// Shown as "Data as of YYYY" in the header for transparency.
const dataAsOf = computed(() => {
  if (!data.value || state.value !== 'done') return null
  // GMR-long and fundamentals/income/cashflow/balance share per_year / annual_data
  const rows = data.value.per_year ?? data.value.annual_data ?? []
  const withData = rows.filter((r) => r.revenue != null || r.net_income != null || r.earnings != null)
  if (!withData.length) return null
  return Math.max(...withData.map((r) => r.year))
})

// ── Formatting helpers ───────────────────────────────────────

function fmtNum(n) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`
  return n.toLocaleString()
}

function fmtPct(n) {
  if (n == null) return '—'
  return `${Number(n).toFixed(1)}%`
}

function fmtRatio(n, decimals = 2) {
  return n != null ? Number(n).toFixed(decimals) : '—'
}

// ── GMR Long: snapshot & annual ─────────────────────────────
const gmrSnapshot = computed(() => {
  const s = data.value?.current_snapshot
  if (!s) return []
  const qr = s.current_liabilities
    ? (
        ((s.current_assets ?? 0) - (s.inventory ?? 0) - (s.prepaid_expenses ?? 0)) /
        s.current_liabilities
      ).toFixed(2)
    : '—'
  return [
    { label: 'Price', value: fmtPrice(s.price), testid: 'snap-price' },
    { label: 'Avg Volume', value: fmtNum(s.avg_volume), testid: 'snap-volume' },
    { label: 'Total Debt', value: fmtMoney(s.total_debt), testid: 'snap-debt' },
    { label: 'Equity', value: fmtMoney(s.equity), testid: 'snap-equity' },
    { label: 'Shares', value: fmtNum(s.shares), testid: 'snap-shares' },
    { label: 'Quick Ratio', value: qr, testid: 'snap-qr' },
    {
      label: 'Last Dividend',
      value:
        s.last_dividend_amount != null
          ? `$${s.last_dividend_amount} (${s.last_dividend_date})`
          : '—',
      testid: 'snap-div',
    },
  ]
})

const gmrAnnualYears = computed(() => {
  if (!data.value) return []
  return [...data.value.annual_data]
    .filter((d) => d.revenue != null || d.avg_price != null)
    .sort((a, b) => b.year - a.year)
    .slice(0, displayYears.value)
    .map((d) => d.year)
})

const gmrAnnualMap = computed(() => {
  if (!data.value) return {}
  return Object.fromEntries(data.value.annual_data.map((d) => [d.year, d]))
})

const gmrAnnualRows = [
  { key: 'avg_price', label: 'Avg Price', fmt: fmtPrice },
  { key: 'revenue', label: 'Revenue', fmt: fmtMoney },
  { key: 'earnings', label: 'Net Income', fmt: fmtMoney },
  { key: 'cfo', label: 'Cash from Ops', fmt: fmtMoney },
  { key: 'delta_ppe', label: 'CapEx (net)', fmt: fmtMoney },
  { key: 'total_assets', label: 'Total Assets', fmt: fmtMoney },
  { key: 'liabilities', label: 'Liabilities', fmt: fmtMoney },
  { key: 'equity', label: 'Equity', fmt: fmtMoney },
]

function gmrCellValue(year, row) {
  return row.fmt(gmrAnnualMap.value[year]?.[row.key])
}

function isNegative(year, key) {
  const v = gmrAnnualMap.value[year]?.[key]
  return v != null && v < 0
}

// ── Fundamentals: market snapshot, ratios, per_year ─────────
const fundMktSnapshot = computed(() => {
  const s = data.value?.market_snapshot
  if (!s) return []
  return [
    { label: 'Price', value: fmtPrice(s.current_price), testid: 'fund-snap-price' },
    { label: 'Market Cap', value: fmtMoney(s.market_cap), testid: 'fund-snap-mcap' },
    { label: 'Shares Out.', value: fmtNum(s.shares_outstanding), testid: 'fund-snap-shares' },
    { label: 'Avg Volume', value: fmtNum(s.avg_volume), testid: 'fund-snap-vol' },
    {
      label: 'Last Dividend',
      value:
        s.last_dividend_amount != null
          ? `$${s.last_dividend_amount} (${s.last_dividend_date})`
          : '—',
      testid: 'fund-snap-div',
    },
    { label: 'Beta', value: fmtRatio(s.beta), testid: 'fund-snap-beta' },
    { label: '52w High', value: fmtPrice(s.week_52_high), testid: 'fund-snap-52h' },
    { label: '52w Low', value: fmtPrice(s.week_52_low), testid: 'fund-snap-52l' },
  ]
})

const fundRatios = computed(() => {
  const r = data.value?.ratios_summary
  if (!r) return []
  return [
    { label: 'Avg P/E',             value: fmtRatio(r.avg_pe, 1) },
    { label: 'Avg P/B',             value: fmtRatio(r.avg_pb) },
    { label: 'Avg ROE',             value: fmtPct(r.avg_roe) },
    { label: 'Avg Net Margin',      value: fmtPct(r.avg_npm) },
    { label: 'Avg Revenue Growth',  value: fmtPct(r.avg_revenue_growth) },
    { label: 'Avg Earnings Growth', value: fmtPct(r.avg_earnings_growth) },
    { label: 'Avg FCF Yield',       value: fmtPct(r.avg_fcf_yield) },
    { label: 'Avg Div. Yield',      value: fmtPct(r.avg_dividend_yield) },
  ]
})

const fundYears = computed(() => {
  if (!data.value) return []
  return [...data.value.per_year]
    .filter((d) => d.revenue != null || d.avg_price != null)
    .sort((a, b) => b.year - a.year)
    .slice(0, displayYears.value)
    .map((d) => d.year)
})

const fundMap = computed(() => {
  if (!data.value) return {}
  return Object.fromEntries(data.value.per_year.map((d) => [d.year, d]))
})

const fundRows = [
  { key: 'avg_price',    label: 'Avg Price',    fmt: fmtPrice },
  { key: 'revenue',      label: 'Revenue',       fmt: fmtMoney },
  { key: 'net_income',   label: 'Net Income',    fmt: fmtMoney },
  { key: 'eps',          label: 'EPS',           fmt: (n) => (n != null ? `$${Number(n).toFixed(2)}` : '—') },
  { key: 'free_cashflow',label: 'Free Cashflow', fmt: fmtMoney },
  { key: 'total_assets', label: 'Total Assets',  fmt: fmtMoney },
  { key: 'equity',       label: 'Equity',        fmt: fmtMoney },
  { key: 'pe',           label: 'P/E',           fmt: (n) => fmtRatio(n, 1) },
  { key: 'roe',          label: 'ROE',           fmt: fmtPct },
  { key: 'npm',          label: 'Net Margin',    fmt: fmtPct },
]

function fundCellValue(year, row) {
  return row.fmt(fundMap.value[year]?.[row.key])
}

function isFundNegative(year, key) {
  const v = fundMap.value[year]?.[key]
  return v != null && v < 0
}
</script>

<template>
  <div class="gmr-fin" data-testid="financials-panel">
    <!-- ── Header ───────────────────────────────────────── -->
    <div class="gmr-fin__header">
      <div class="flex items-center gap-3 flex-wrap">
        <span class="gmr-fin__title">{{ symbol }}</span>
        <span
          class="badge"
          :class="isEu ? 'badge-esef' : 'badge-edgar'"
          :data-testid="`badge-source-${dataSource}`"
        >{{ dataSource.toUpperCase() }}</span>
        <span v-if="state === 'done'" class="gmr-fin__subtitle">
          {{ viewLabel }}
        </span>
        <span
          v-if="dataAsOf"
          class="gmr-fin__subtitle"
          data-testid="data-as-of"
          style="opacity:0.65"
        >· data as of {{ dataAsOf }}</span>
      </div>
      <div class="flex items-center gap-1">
        <!-- Copy link -->
        <button
          type="button"
          class="gmr-fin__close"
          :aria-label="linkCopied ? 'Link copied' : 'Copy link'"
          :title="linkCopied ? 'Copied!' : 'Copy link to this view'"
          data-testid="copy-link-btn"
          @click="copyLink"
        >
          <svg
            v-if="!linkCopied"
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M4 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4zm0 1h5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
            <path d="M10 1h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H11v-1h1a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-2V1z"/>
          </svg>
          <svg
            v-else
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
            style="color: #22c55e"
          >
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
          </svg>
        </button>
        <!-- Close -->
        <button
          type="button"
          class="gmr-fin__close"
          aria-label="Close financials"
          @click="emit('close')"
        >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line x1="1" y1="1" x2="13" y2="13" />
          <line x1="13" y1="1" x2="1" y2="13" />
        </svg>
        </button>
      </div>
    </div>

    <!-- ── Years selector ───────────────────────────────── -->
    <div
      v-if="state === 'done' && view !== 'summary'"
      class="year-selector"
      data-testid="year-selector"
    >
      <span class="year-selector__label">History</span>
      <button
        v-for="opt in YEAR_OPTIONS"
        :key="opt.testid"
        class="year-btn"
        :class="{ active: displayYears === opt.value }"
        :data-testid="`year-btn-${opt.testid}`"
        @click="displayYears = opt.value"
      >{{ opt.label }}</button>
    </div>

    <!-- ── Skeleton loader ─────────────────────────────── -->
    <div v-if="state === 'loading'" class="gmr-fin__body" data-testid="fin-loading">
      <!-- snapshot chip row -->
      <div class="sk-snap">
        <div v-for="n in 8" :key="n" class="sk-snap__cell">
          <div class="sk-bar sk-bar--xs" />
          <div class="sk-bar sk-bar--md" />
        </div>
      </div>
      <!-- section label -->
      <div class="sk-bar sk-bar--section" />
      <!-- table rows -->
      <div class="sk-table">
        <div v-for="r in 8" :key="r" class="sk-table__row">
          <div class="sk-bar sk-bar--label" />
          <div v-for="c in 5" :key="c" class="sk-bar sk-bar--cell" />
        </div>
      </div>
    </div>

    <!-- ── Timeout ──────────────────────────────────────── -->
    <div v-else-if="state === 'timeout'" class="gmr-fin__body gmr-fin__state" data-testid="fin-timeout">
      <div style="display:flex;flex-direction:column;align-items:center;gap:0.75rem">
        <span style="color: var(--muted)">Taking longer than expected…</span>
        <button
          class="year-btn"
          style="padding:0.4rem 1rem"
          data-testid="fin-retry"
          @click="loadData(symbol)"
        >Retry</button>
      </div>
    </div>

    <!-- ── Error ───────────────────────────────────────── -->
    <div v-else-if="state === 'error'" class="gmr-fin__body gmr-fin__state" data-testid="fin-error">
      <div style="display:flex;flex-direction:column;align-items:center;gap:0.75rem">
        <span style="color: var(--negative)">Could not load data for {{ symbol }}.</span>
        <button
          class="year-btn"
          style="padding:0.4rem 1rem"
          data-testid="fin-retry-error"
          @click="loadData(symbol)"
        >Retry</button>
      </div>
    </div>

    <!-- ── Summary (price chart) ────────────────────────── -->
    <template v-else-if="state === 'done' && view === 'summary'">
      <SummaryPanel :symbol="symbol" data-testid="summary-panel-wrap" />
    </template>

    <!-- ── GMR Long data ────────────────────────────────── -->
    <template v-else-if="state === 'done' && data && view === 'gmr-long'">
      <div class="gmr-snap" data-testid="snapshot-grid">
        <div
          v-for="item in gmrSnapshot"
          :key="item.label"
          class="gmr-snap__cell"
          :data-testid="item.testid"
        >
          <div class="gmr-snap__label">{{ item.label }}</div>
          <div class="gmr-snap__value">{{ item.value }}</div>
        </div>
      </div>

      <div class="gmr-fin__section-label">Annual Data</div>

      <div class="gmr-ann-wrap" data-testid="annual-table">
        <table class="gmr-ann">
          <thead>
            <tr>
              <th>Metric</th>
              <th v-for="year in gmrAnnualYears" :key="year">{{ year }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in gmrAnnualRows" :key="row.key">
              <td>{{ row.label }}</td>
              <td
                v-for="year in gmrAnnualYears"
                :key="year"
                :class="{ 'gmr-ann__neg': isNegative(year, row.key) }"
              >
                {{ gmrCellValue(year, row) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ── Valuation data ───────────────────────────────── -->
    <template v-else-if="state === 'done' && data && view === 'valuation'">
      <ValuationPanel :data="data" :display-years="displayYears" data-testid="valuation-panel" />
    </template>

    <!-- ── Income & Growth ──────────────────────────────── -->
    <template v-else-if="state === 'done' && data && view === 'income'">
      <div data-testid="income-panel-wrap">
        <IncomePanel :data="data" :display-years="displayYears" />
      </div>
    </template>

    <!-- ── Cash Flow ─────────────────────────────────────── -->
    <template v-else-if="state === 'done' && data && view === 'cashflow'">
      <div data-testid="cashflow-panel-wrap">
        <CashflowPanel :data="data" :display-years="displayYears" />
      </div>
    </template>

    <!-- ── Balance Sheet ─────────────────────────────────── -->
    <template v-else-if="state === 'done' && data && view === 'balance'">
      <div data-testid="balance-panel-wrap">
        <BalancePanel :data="data" :display-years="displayYears" />
      </div>
    </template>

    <!-- ── Fundamentals data ────────────────────────────── -->
    <template v-else-if="state === 'done' && data">
      <div class="gmr-snap" data-testid="fund-mkt-snapshot">
        <div
          v-for="item in fundMktSnapshot"
          :key="item.label"
          class="gmr-snap__cell"
          :data-testid="item.testid"
        >
          <div class="gmr-snap__label">{{ item.label }}</div>
          <div class="gmr-snap__value">{{ item.value }}</div>
        </div>
      </div>

      <div class="gmr-fin__section-label">Averages</div>

      <div class="gmr-snap gmr-snap--wide" data-testid="fund-ratios">
        <div v-for="item in fundRatios" :key="item.label" class="gmr-snap__cell">
          <div class="gmr-snap__label">{{ item.label }}</div>
          <div class="gmr-snap__value">{{ item.value }}</div>
        </div>
      </div>

      <div class="gmr-fin__section-label">Per Year</div>

      <div class="gmr-ann-wrap" data-testid="fund-annual-table">
        <table class="gmr-ann">
          <thead>
            <tr>
              <th>Metric</th>
              <th v-for="year in fundYears" :key="year">{{ year }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in fundRows" :key="row.key">
              <td>{{ row.label }}</td>
              <td
                v-for="year in fundYears"
                :key="year"
                :class="{ 'gmr-ann__neg': isFundNegative(year, row.key) }"
              >
                {{ fundCellValue(year, row) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ── Skeleton loader ─────────────────────────────────────────── */
@keyframes sk-shimmer {
  from { background-position: -400px 0; }
  to   { background-position: calc(400px + 100%) 0; }
}

.sk-bar {
  border-radius: 3px;
  background: linear-gradient(
    90deg,
    var(--border) 25%,
    var(--surface) 50%,
    var(--border) 75%
  );
  background-size: 800px 100%;
  animation: sk-shimmer 1.5s ease infinite;
}

.sk-bar--xs      { height: 9px;  width: 50%; }
.sk-bar--md      { height: 14px; width: 70%; }
.sk-bar--section { height: 10px; width: 64px; margin: 0.9rem 0 0.5rem; }
.sk-bar--label   { height: 13px; width: 100px; flex-shrink: 0; }
.sk-bar--cell    { height: 13px; flex: 1; }

.sk-snap {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.6rem;
}

.sk-snap__cell {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
}

.sk-table {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sk-table__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--border);
}
</style>
