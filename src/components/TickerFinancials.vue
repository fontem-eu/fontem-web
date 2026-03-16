<script setup>
import { ref, watch, computed } from 'vue'
import { fetchGmrData } from '../api/gmr.js'

const props = defineProps({
  symbol: { type: String, required: true },
})

const emit = defineEmits(['close'])

const data  = ref(null)
const state = ref('loading') // 'loading' | 'done' | 'error'

watch(
  () => props.symbol,
  async (sym) => {
    if (!sym) return
    data.value  = null
    state.value = 'loading'
    try {
      data.value  = await fetchGmrData(sym)
      state.value = 'done'
    } catch {
      state.value = 'error'
    }
  },
  { immediate: true }
)

// ── Formatting helpers ───────────────────────────────────────
function fmtMoney(n, decimals = 1) {
  if (n == null) return '—'
  const neg = n < 0
  const abs = Math.abs(n)
  const sign = neg ? '-' : ''
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(decimals)}T`
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(decimals)}B`
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(decimals)}M`
  if (abs >= 1e3)  return `${sign}$${(abs / 1e3).toFixed(0)}K`
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

// ── Snapshot KV items ────────────────────────────────────────
const snapshot = computed(() => {
  const s = data.value?.current_snapshot
  if (!s) return []
  const qr =
    s.current_liabilities
      ? (((s.current_assets ?? 0) - (s.inventory ?? 0) - (s.prepaid_expenses ?? 0)) /
          s.current_liabilities).toFixed(2)
      : '—'
  return [
    { label: 'Price',         value: fmtPrice(s.price),             testid: 'snap-price'   },
    { label: 'Avg Volume',    value: fmtNum(s.avg_volume),          testid: 'snap-volume'  },
    { label: 'Total Debt',    value: fmtMoney(s.total_debt),        testid: 'snap-debt'    },
    { label: 'Equity',        value: fmtMoney(s.equity),            testid: 'snap-equity'  },
    { label: 'Shares',        value: fmtNum(s.shares),              testid: 'snap-shares'  },
    { label: 'Quick Ratio',   value: qr,                            testid: 'snap-qr'      },
    { label: 'Last Dividend', value: s.last_dividend_amount != null
        ? `$${s.last_dividend_amount} (${s.last_dividend_date})` : '—',
      testid: 'snap-div' },
  ]
})

// ── Annual table ─────────────────────────────────────────────
// Columns = years (oldest → newest), excluding years with no income data
const annualYears = computed(() => {
  if (!data.value) return []
  return [...data.value.annual_data]
    .filter(d => d.revenue != null || d.avg_price != null)
    .sort((a, b) => a.year - b.year)
    .map(d => d.year)
})

const annualMap = computed(() => {
  if (!data.value) return {}
  return Object.fromEntries(data.value.annual_data.map(d => [d.year, d]))
})

// Row definitions — each row is one financial metric across all years
const annualRows = [
  { key: 'avg_price',    label: 'Avg Price',      fmt: fmtPrice, accent: false },
  { key: 'revenue',      label: 'Revenue',         fmt: fmtMoney, accent: false },
  { key: 'earnings',     label: 'Net Income',      fmt: fmtMoney, accent: false },
  { key: 'cfo',          label: 'Cash from Ops',   fmt: fmtMoney, accent: false },
  { key: 'delta_ppe',    label: 'CapEx (net)',      fmt: fmtMoney, accent: false },
  { key: 'total_assets', label: 'Total Assets',    fmt: fmtMoney, accent: false },
  { key: 'liabilities',  label: 'Liabilities',     fmt: fmtMoney, accent: false },
  { key: 'equity',       label: 'Equity',          fmt: fmtMoney, accent: false },
]

function cellValue(year, row) {
  return row.fmt(annualMap.value[year]?.[row.key])
}

// Highlight negative CFO / CapEx
function isNegative(year, key) {
  const v = annualMap.value[year]?.[key]
  return v != null && v < 0
}
</script>

<template>
  <div class="gmr-fin" data-testid="financials-panel">
    <!-- ── Header ───────────────────────────────────────── -->
    <div class="gmr-fin__header">
      <div class="flex items-center gap-3">
        <span class="gmr-fin__title">{{ symbol }}</span>
        <span class="gmr-fin__subtitle" v-if="state === 'done'">
          Financial Overview
        </span>
      </div>
      <button
        type="button"
        class="gmr-fin__close"
        aria-label="Close financials"
        @click="emit('close')"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
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

    <!-- ── Data ────────────────────────────────────────── -->
    <template v-else-if="state === 'done' && data">

      <!-- Current snapshot grid -->
      <div class="gmr-snap" data-testid="snapshot-grid">
        <div
          v-for="item in snapshot"
          :key="item.label"
          class="gmr-snap__cell"
          :data-testid="item.testid"
        >
          <div class="gmr-snap__label">{{ item.label }}</div>
          <div class="gmr-snap__value">{{ item.value }}</div>
        </div>
      </div>

      <!-- Section label -->
      <div class="gmr-fin__section-label">Annual Data</div>

      <!-- Transposed annual table -->
      <div class="gmr-ann-wrap" data-testid="annual-table">
        <table class="gmr-ann">
          <thead>
            <tr>
              <th>Metric</th>
              <th v-for="year in annualYears" :key="year">{{ year }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in annualRows" :key="row.key">
              <td>{{ row.label }}</td>
              <td
                v-for="year in annualYears"
                :key="year"
                :class="{ 'gmr-ann__neg': isNegative(year, row.key) }"
              >
                {{ cellValue(year, row) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </template>
  </div>
</template>
