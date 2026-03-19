<script setup>
import { ref, watch, computed } from 'vue'
import { fetchGmrData, fetchFundamentals } from '../api/gmr.js'

const props = defineProps({
  symbol: { type: String, required: true },
  view: { type: String, default: 'fundamentals' }, // 'fundamentals' | 'gmr-long'
})

const emit = defineEmits(['close'])

const data = ref(null)
const state = ref('loading') // 'loading' | 'done' | 'error'

watch(
  () => [props.symbol, props.view],
  async ([sym]) => {
    if (!sym) return
    data.value = null
    state.value = 'loading'
    try {
      data.value =
        props.view === 'gmr-long' ? await fetchGmrData(sym) : await fetchFundamentals(sym)
      state.value = 'done'
    } catch {
      state.value = 'error'
    }
  },
  { immediate: true }
)

const viewLabel = computed(() =>
  props.view === 'gmr-long' ? 'Financial Overview' : 'Fundamentals'
)

// ── Formatting helpers ───────────────────────────────────────
function fmtMoney(n, decimals = 1) {
  if (n == null) return '—'
  const neg = n < 0
  const abs = Math.abs(n)
  const sign = neg ? '-' : ''
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(decimals)}T`
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(decimals)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(decimals)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`
  return `${sign}$${abs.toLocaleString()}`
}

function fmtPrice(n) {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

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
    .sort((a, b) => a.year - b.year)
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
  ]
})

const fundRatios = computed(() => {
  const r = data.value?.ratios_summary
  if (!r) return []
  return [
    { label: 'Avg ROE', value: fmtPct(r.avg_roe) },
    { label: 'Avg ROA', value: fmtPct(r.avg_roa) },
    { label: 'Avg Net Margin', value: fmtPct(r.avg_npm) },
    { label: 'Avg Gross Margin', value: fmtPct(r.avg_gross_margin) },
    { label: 'Avg Op. Margin', value: fmtPct(r.avg_operating_margin) },
    {
      label: 'Avg Current Ratio',
      value: r.avg_current_ratio != null ? Number(r.avg_current_ratio).toFixed(2) : '—',
    },
    {
      label: 'Avg Quick Ratio',
      value: r.avg_quick_ratio != null ? Number(r.avg_quick_ratio).toFixed(2) : '—',
    },
    {
      label: 'Avg D/E',
      value: r.avg_debt_to_equity != null ? Number(r.avg_debt_to_equity).toFixed(2) : '—',
    },
    { label: 'Avg Revenue Growth', value: fmtPct(r.avg_revenue_growth) },
    { label: 'Avg Earnings Growth', value: fmtPct(r.avg_earnings_growth) },
  ]
})

const fundYears = computed(() => {
  if (!data.value) return []
  return [...data.value.per_year]
    .filter((d) => d.revenue != null || d.avg_price != null)
    .sort((a, b) => a.year - b.year)
    .map((d) => d.year)
})

const fundMap = computed(() => {
  if (!data.value) return {}
  return Object.fromEntries(data.value.per_year.map((d) => [d.year, d]))
})

const fundRows = [
  { key: 'avg_price', label: 'Avg Price', fmt: fmtPrice },
  { key: 'revenue', label: 'Revenue', fmt: fmtMoney },
  { key: 'gross_profit', label: 'Gross Profit', fmt: fmtMoney },
  { key: 'operating_income', label: 'Op. Income', fmt: fmtMoney },
  { key: 'net_income', label: 'Net Income', fmt: fmtMoney },
  { key: 'operating_cashflow', label: 'Op. Cashflow', fmt: fmtMoney },
  { key: 'capex', label: 'CapEx', fmt: fmtMoney },
  { key: 'free_cashflow', label: 'Free Cashflow', fmt: fmtMoney },
  { key: 'total_assets', label: 'Total Assets', fmt: fmtMoney },
  { key: 'total_liabilities', label: 'Total Liabilities', fmt: fmtMoney },
  { key: 'equity', label: 'Equity', fmt: fmtMoney },
  { key: 'roe', label: 'ROE', fmt: fmtPct },
  { key: 'npm', label: 'Net Margin', fmt: fmtPct },
  { key: 'gross_margin', label: 'Gross Margin', fmt: fmtPct },
  { key: 'operating_margin', label: 'Op. Margin', fmt: fmtPct },
  {
    key: 'current_ratio',
    label: 'Current Ratio',
    fmt: (n) => (n != null ? Number(n).toFixed(2) : '—'),
  },
  { key: 'debt_to_equity', label: 'D/E', fmt: (n) => (n != null ? Number(n).toFixed(2) : '—') },
  { key: 'revenue_growth', label: 'Rev. Growth', fmt: fmtPct },
  { key: 'earnings_growth', label: 'EPS Growth', fmt: fmtPct },
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
      <div class="flex items-center gap-3">
        <span class="gmr-fin__title">{{ symbol }}</span>
        <span v-if="state === 'done'" class="gmr-fin__subtitle">
          {{ viewLabel }}
        </span>
      </div>
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

    <!-- ── Loading ─────────────────────────────────────── -->
    <div v-if="state === 'loading'" class="gmr-fin__body gmr-fin__state" data-testid="fin-loading">
      <span class="animate-pulse" style="color: var(--muted)">Loading…</span>
    </div>

    <!-- ── Error ───────────────────────────────────────── -->
    <div v-else-if="state === 'error'" class="gmr-fin__body gmr-fin__state" data-testid="fin-error">
      <span style="color: var(--accent)">Could not load data for {{ symbol }}.</span>
    </div>

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
