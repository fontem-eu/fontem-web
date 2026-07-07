<script setup>
import { ref, watch, computed } from 'vue'
import { fetchGmrData, fetchFundamentals, fetchValuation } from '../api/gmr.js'
import { fmtMoney, fmtPrice } from '../utils/format.js'
import SummaryPanel from './SummaryPanel.vue'
import ValuationPanel from './ValuationPanel.vue'
import IncomePanel from './IncomePanel.vue'
import CashflowPanel from './CashflowPanel.vue'
import BalancePanel from './BalancePanel.vue'
import ContractsPanel from './ContractsPanel.vue'
import ProfilePanel from './ProfilePanel.vue'
import GraphExplorer from './GraphExplorer.vue'
import EntityNutsMap from './EntityNutsMap.vue'

const props = defineProps({
  symbol: { type: String, required: true },
  view: { type: String, default: 'fundamentals' }, // 'fundamentals' | 'gmr-long' | 'valuation' | 'summary'
})

const emit = defineEmits(['close', 'company-resolved'])

// ── Copy link ────────────────────────────────────────────────
const linkCopied = ref(false)
let _copyTimer = null
function copyLink() {
  navigator.clipboard?.writeText(globalThis.location.href).then(() => {
    linkCopied.value = true
    clearTimeout(_copyTimer)
    _copyTimer = setTimeout(() => { linkCopied.value = false }, 1800)
  })
}

// EU tickers follow SYMBOL.EXCHANGE pattern (e.g. ASML.AS, SAP.DE)
const isEu = computed(() => /^[A-Z0-9]+\.[A-Z]{1,3}$/i.test(props.symbol))
const dataSource = computed(() => isEu.value ? 'esef' : 'edgar')

const data = ref(null)
const companyGmrId = ref(null)
const companyName = ref(null)
// 'company' | 'authority' | null while unresolved. Drives the
// ContractsPanel counterparty header (Authority vs Contractor) and
// is also surfaced to the parent via `company-resolved` so HomeView
// can hide the Financials tab on authorities.
const entityKind = ref(null)
const state = ref('loading') // 'loading' | 'done' | 'error' | 'timeout'
const displayYears = ref(10)

const YEAR_OPTIONS = [
  { value: 5,        label: '5Y',  testid: '5'   },
  { value: 7,        label: '7Y',  testid: '7'   },
  { value: 10,       label: '10Y', testid: '10'  },
  { value: Infinity, label: 'ticker_financials.all', testid: 'all' },
]

let _loadId = 0

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i
// True when the route handed us a bare gmr_id UUID instead of a ticker.
// The header pill and inline copy use this to avoid spelling the UUID
// out at the user — it's noise, not signal.
const isUuidSymbol = computed(() => UUID_RE.test(props.symbol || ''))
// Header title: the resolved company name when we have it; otherwise
// the human-readable symbol; otherwise a generic label. The previous
// `companyName || symbol` fallback rendered the raw UUID during the
// summary view's no-load path (state == 'done' immediately so
// companyName never resolves) — exactly the noise the user reported.
const headerLabel = computed(() => companyName.value
  || (isUuidSymbol.value ? 'Entity profile' : props.symbol))

async function _tryFetchJson(url) {
  try {
    const res = await fetch(url)
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

async function _resolveUuidEntity(sym, { profile = false } = {}) {
  if (!UUID_RE.test(sym)) return null
  // `/api/companies/<UUID>` returns 200 with `company_name: null` for
  // authority UUIDs — it's a stub, not a 404. Treating the bare object
  // as truthy was the original bug: the resolver short-circuited on the
  // stub and never reached the authorities endpoint, so the header fell
  // back to rendering the UUID. Require a real `company_name` to keep
  // going down the company path.
  const companyInfo = await _tryFetchJson(`/api/companies/${encodeURIComponent(sym)}`)
  if (companyInfo?.company_name) {
    return profile
      ? { gmr_id: sym, company_name: companyInfo.company_name, ticker: sym, _entityType: 'company' }
      : { ...companyInfo, _entityType: 'company' }
  }
  const authorityInfo = await _tryFetchJson(`/api/authorities/${encodeURIComponent(sym)}`)
  if (!authorityInfo) return null
  const base = {
    gmr_id: sym,
    company_name: authorityInfo.authority_name,
    _entityType: 'authority',
  }
  if (!profile) return base
  return {
    ...base,
    ticker: sym,
    country: authorityInfo.country,
    contract_count: authorityInfo.contract_count,
    total_spend_eur: authorityInfo.total_spend_eur,
  }
}

async function _fetchProfileResult(sym) {
  try {
    return await fetchFundamentals(sym)
  } catch {
    const fallback = await _resolveUuidEntity(sym, { profile: true })
    return fallback ?? { ticker: sym }
  }
}

async function _fetchPanelResult(sym) {
  try {
    return await fetchFundamentals(sym, 1)
  } catch {
    return await _resolveUuidEntity(sym, { profile: false })
  }
}

async function _resolveResult(sym) {
  if (props.view === 'gmr-long') return fetchGmrData(sym)
  if (props.view === 'valuation') return fetchValuation(sym)
  if (props.view === 'profile') return _fetchProfileResult(sym)
  if (['fundamentals', 'income', 'cashflow', 'balance'].includes(props.view)) {
    return fetchFundamentals(sym)
  }
  return null
}

function _emitResolved(sym, result) {
  if (!result?.gmr_id && !result?.company_name) return
  emit('company-resolved', {
    id: sym,
    name: result.company_name || sym,
    gmr_id: result.gmr_id,
    // 'company' | 'authority' — drives parent-side tab visibility
    // (Financials only makes sense for companies). Falls back to
    // 'company' when the resolver couldn't decide so existing flows
    // keep working unchanged.
    kind: result._entityType || 'company',
  })
}

async function _loadPanelOnlyView(sym, id) {
  const result = await _fetchPanelResult(sym)
  if (_loadId !== id) return
  if (result) {
    companyGmrId.value = result.gmr_id ?? null
    companyName.value = result.company_name ?? null
    entityKind.value = result._entityType ?? null
    _emitResolved(sym, result)
  }
  data.value = null
  state.value = 'done'
}

async function loadData(sym) {
  const id = ++_loadId
  data.value = null
  state.value = 'loading'

  // 15-second timeout: if API takes too long, surface a retry option.
  const timeout = setTimeout(() => {
    if (_loadId === id) state.value = 'timeout'
  }, 15000)

  try {
    if (props.view === 'contracts' || props.view === 'graph') {
      await _loadPanelOnlyView(sym, id)
      return
    }
    const result = await _resolveResult(sym)
    if (_loadId !== id) return // stale response
    data.value = result ?? null
    companyGmrId.value = result?.gmr_id ?? null
    companyName.value = result?.company_name ?? null
    entityKind.value = result?._entityType ?? null
    state.value = 'done'
    _emitResolved(props.symbol, result)
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
    // We still resolve the entity name here so the header title shows
    // the company / authority name instead of the raw UUID — otherwise
    // companyName stays null forever on this view path.
    if (props.view === 'summary') {
      state.value = 'done'
      data.value = null
      _resolveUuidEntity(sym, { profile: true }).then((info) => {
        if (info?.company_name) {
          companyName.value = info.company_name
          companyGmrId.value = info.gmr_id ?? null
          entityKind.value = info._entityType ?? null
          _emitResolved(sym, info)
        }
      })
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
  return n == null ? '—' : Number(n).toFixed(decimals)
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
    { label: 'ticker_financials.price', value: fmtPrice(s.price), testid: 'snap-price' },
    { label: 'ticker_financials.avg_volume', value: fmtNum(s.avg_volume), testid: 'snap-volume' },
    { label: 'ticker_financials.total_debt', value: fmtMoney(s.total_debt), testid: 'snap-debt' },
    { label: 'ticker_financials.equity', value: fmtMoney(s.equity), testid: 'snap-equity' },
    { label: 'ticker_financials.shares', value: fmtNum(s.shares), testid: 'snap-shares' },
    { label: 'ticker_financials.quick_ratio', value: qr, testid: 'snap-qr' },
    {
      label: 'ticker_financials.last_dividend',
      value:
        s.last_dividend_amount != null && s.last_dividend_amount > 0
          ? `${s.last_dividend_amount} (${s.last_dividend_date || 'N/A'})`
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
  { key: 'avg_price', label: 'ticker_financials.avg_price', fmt: fmtPrice },
  { key: 'revenue', label: 'ticker_financials.revenue', fmt: fmtMoney },
  { key: 'earnings', label: 'ticker_financials.net_income', fmt: fmtMoney },
  { key: 'cfo', label: 'ticker_financials.cash_from_ops', fmt: fmtMoney },
  { key: 'delta_ppe', label: 'ticker_financials.capex_net', fmt: fmtMoney },
  { key: 'total_assets', label: 'ticker_financials.total_assets', fmt: fmtMoney },
  { key: 'liabilities', label: 'ticker_financials.liabilities', fmt: fmtMoney },
  { key: 'equity', label: 'ticker_financials.equity', fmt: fmtMoney },
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
    { label: 'ticker_financials.price', value: fmtPrice(s.current_price), testid: 'fund-snap-price' },
    { label: 'ticker_financials.market_cap', value: fmtMoney(s.market_cap), testid: 'fund-snap-mcap' },
    { label: 'ticker_financials.shares_out', value: fmtNum(s.shares_outstanding), testid: 'fund-snap-shares' },
    { label: 'ticker_financials.avg_volume', value: fmtNum(s.avg_volume), testid: 'fund-snap-vol' },
    {
      label: 'ticker_financials.last_dividend',
      value:
        s.last_dividend_amount != null && s.last_dividend_amount > 0
          ? `${s.last_dividend_amount} (${s.last_dividend_date || 'N/A'})`
          : '—',
      testid: 'fund-snap-div',
    },
    { label: 'ticker_financials.beta', value: fmtRatio(s.beta), testid: 'fund-snap-beta' },
    { label: 'ticker_financials.52w_high', value: fmtPrice(s.week_52_high), testid: 'fund-snap-52h' },
    { label: 'ticker_financials.52w_low', value: fmtPrice(s.week_52_low), testid: 'fund-snap-52l' },
  ]
})

const fundRatios = computed(() => {
  const r = data.value?.ratios_summary
  if (!r) return []
  return [
    { label: 'ticker_financials.avg_pe',             value: fmtRatio(r.avg_pe, 1) },
    { label: 'ticker_financials.avg_pb',             value: fmtRatio(r.avg_pb) },
    { label: 'ticker_financials.avg_roe',             value: fmtPct(r.avg_roe) },
    { label: 'ticker_financials.avg_net_margin',      value: fmtPct(r.avg_npm) },
    { label: 'ticker_financials.avg_revenue_growth',  value: fmtPct(r.avg_revenue_growth) },
    { label: 'ticker_financials.avg_earnings_growth', value: fmtPct(r.avg_earnings_growth) },
    { label: 'ticker_financials.avg_fcf_yield',       value: fmtPct(r.avg_fcf_yield) },
    { label: 'ticker_financials.avg_div_yield',      value: fmtPct(r.avg_dividend_yield) },
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
  { key: 'avg_price',    label: 'ticker_financials.avg_price',    fmt: fmtPrice },
  { key: 'revenue',      label: 'ticker_financials.revenue',       fmt: fmtMoney },
  { key: 'net_income',   label: 'ticker_financials.net_income',    fmt: fmtMoney },
  { key: 'eps',          label: 'EPS',           fmt: (n) => (n == null ? '—' : `$${Number(n).toFixed(2)}`) },
  { key: 'free_cashflow',label: 'ticker_financials.free_cashflow', fmt: fmtMoney },
  { key: 'total_assets', label: 'ticker_financials.total_assets',  fmt: fmtMoney },
  { key: 'equity',       label: 'ticker_financials.equity',        fmt: fmtMoney },
  { key: 'pe',           label: 'P/E',           fmt: (n) => fmtRatio(n, 1) },
  { key: 'roe',          label: 'ROE',           fmt: fmtPct },
  { key: 'npm',          label: 'ticker_financials.net_margin',    fmt: fmtPct },
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
        <span class="gmr-fin__title" data-testid="financials-title">{{ headerLabel }}</span>
        <span v-if="companyName && symbol !== companyName && !isUuidSymbol" class="gmr-fin__ticker-tag">{{ symbol }}</span>
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
        >· {{ $t('ticker_financials.data_as_of') }} {{ dataAsOf }}</span>
      </div>
      <div class="flex items-center gap-1">
        <!-- Copy link -->
        <button
          type="button"
          class="gmr-fin__close"
          :aria-label="linkCopied ? $t('ticker_financials.link_copied') : $t('ticker_financials.copy_link')"
          :title="linkCopied ? $t('ticker_financials.copied') : $t('ticker_financials.copy_link_to_this_view')"
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
          :aria-label="$t('ticker_financials.close_financials')"
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
      <span class="year-selector__label">{{ $t('ticker_financials.history') }}</span>
      <button
        v-for="opt in YEAR_OPTIONS"
        :key="opt.testid"
        class="year-btn"
        :class="{ active: displayYears === opt.value }"
        :data-testid="`year-btn-${opt.testid}`"
        @click="displayYears = opt.value"
      >{{ $t(opt.label) }}</button>
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
        <span style="color: var(--muted)">{{ $t('ticker_financials.taking_longer_than_expected') }}</span>
        <button
          class="year-btn"
          style="padding:0.4rem 1rem"
          data-testid="fin-retry"
          @click="loadData(symbol)"
        >{{ $t('app.retry') }}</button>
      </div>
    </div>

    <!-- ── Error ───────────────────────────────────────── -->
    <div v-else-if="state === 'error'" class="gmr-fin__body gmr-fin__state" data-testid="fin-error">
      <div style="display:flex;flex-direction:column;align-items:center;gap:0.75rem">
        <span style="color: var(--negative)">{{ $t('ticker_financials.could_not_load_data_for') }} {{ companyName || (isUuidSymbol ? $t('ticker_financials.this_entity') : symbol) }}.</span>
        <button
          class="year-btn"
          style="padding:0.4rem 1rem"
          data-testid="fin-retry-error"
          @click="loadData(symbol)"
        >{{ $t('app.retry') }}</button>
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
          <div class="gmr-snap__label">{{ $t(item.label) }}</div>
          <div class="gmr-snap__value">{{ item.value }}</div>
        </div>
      </div>

      <div class="gmr-fin__section-label">{{ $t('ticker_financials.annual_data') }}</div>

      <div class="gmr-ann-wrap" data-testid="annual-table">
        <table class="gmr-ann">
          <thead>
            <tr>
              <th>{{ $t('ticker_financials.metric') }}</th>
              <th v-for="year in gmrAnnualYears" :key="year">{{ year }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in gmrAnnualRows" :key="row.key">
              <td>{{ $t(row.label) }}</td>
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

    <!-- ── Profile ───────────────────────────────────────── -->
    <template v-else-if="state === 'done' && view === 'profile'">
      <div data-testid="profile-panel-wrap">
        <ProfilePanel
          :symbol="symbol"
          :data="data"
          :gmr-id="companyGmrId || symbol"
          :company-name="companyName"
        />
      </div>
    </template>

    <!-- ── Contracts ─────────────────────────────────────── -->
    <template v-else-if="state === 'done' && view === 'contracts'">
      <div data-testid="contracts-panel-wrap">
        <ContractsPanel
          :symbol="companyGmrId || symbol"
          :entity-kind="entityKind"
        />
      </div>
    </template>

    <!-- ── Graph Explorer ───────────────────────────────────── -->
    <template v-else-if="state === 'done' && view === 'graph'">
      <div data-testid="graph-panel-wrap">
        <GraphExplorer :entity-id="companyGmrId || symbol" />
      </div>
    </template>

    <!-- ── Entity Business Map ──────────────────────────────── -->
    <template v-else-if="view === 'entity-nuts-map'">
      <div data-testid="entity-nuts-map-wrap">
        <EntityNutsMap :entity-id="companyGmrId || symbol" />
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
          <div class="gmr-snap__label">{{ $t(item.label) }}</div>
          <div class="gmr-snap__value">{{ item.value }}</div>
        </div>
      </div>

      <div class="gmr-fin__section-label">{{ $t('ticker_financials.averages') }}</div>

      <div class="gmr-snap gmr-snap--wide" data-testid="fund-ratios">
        <div v-for="item in fundRatios" :key="item.label" class="gmr-snap__cell">
          <div class="gmr-snap__label">{{ $t(item.label) }}</div>
          <div class="gmr-snap__value">{{ item.value }}</div>
        </div>
      </div>

      <div class="gmr-fin__section-label">{{ $t('ticker_financials.per_year') }}</div>

      <div class="gmr-ann-wrap" data-testid="fund-annual-table">
        <table class="gmr-ann">
          <thead>
            <tr>
              <th>{{ $t('ticker_financials.metric') }}</th>
              <th v-for="year in fundYears" :key="year">{{ year }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in fundRows" :key="row.key">
              <td>{{ $t(row.label) }}</td>
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
