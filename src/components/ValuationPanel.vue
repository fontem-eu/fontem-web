<script setup>
const props = defineProps({
  data:         { type: Object, required: true },
  displayYears: { type: Number, default: 10 },
})

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

function fmtPct(n) {
  if (n == null) return '—'
  return `${Number(n).toFixed(1)}%`
}

function fmtRatio(n, decimals = 2) {
  return n != null ? `${Number(n).toFixed(decimals)}x` : '—'
}

// ── Valuation snapshot items ──────────────────────────────────
function snapItems(snap) {
  if (!snap) return []
  return [
    { label: 'Enterprise Value', value: fmtMoney(snap.enterprise_value), testid: 'val-ev' },
    { label: 'Market Cap', value: fmtMoney(snap.market_cap), testid: 'val-mcap' },
    { label: 'EV / EBITDA', value: fmtRatio(snap.ev_ebitda), testid: 'val-ev-ebitda' },
    { label: 'EV / Revenue', value: fmtRatio(snap.ev_revenue), testid: 'val-ev-rev' },
    { label: 'EV / FCF', value: fmtRatio(snap.ev_fcf), testid: 'val-ev-fcf' },
    { label: 'EV / EBIT', value: fmtRatio(snap.ev_ebit), testid: 'val-ev-ebit' },
  ]
}

// ── Summary items ─────────────────────────────────────────────
function summaryItems(summary) {
  if (!summary) return []
  return [
    { label: 'Avg EBITDA Margin', value: fmtPct(summary.avg_ebitda_margin) },
    { label: 'Avg ROIC', value: fmtPct(summary.avg_roic) },
    { label: 'Avg Interest Coverage', value: fmtRatio(summary.avg_interest_coverage) },
    { label: 'Avg Net Debt / EBITDA', value: fmtRatio(summary.avg_net_debt_to_ebitda) },
  ]
}

// ── Per-year table config ─────────────────────────────────────
const perYearRows = [
  { key: 'da', label: 'D&A', fmt: fmtMoney },
  { key: 'interest_expense', label: 'Interest Expense', fmt: fmtMoney },
  { key: 'cash_and_equivalents', label: 'Cash & Equiv.', fmt: fmtMoney },
  { key: 'long_term_debt', label: 'LT Debt', fmt: fmtMoney },
  { key: 'ebitda', label: 'EBITDA', fmt: fmtMoney },
  { key: 'ebitda_margin', label: 'EBITDA Margin', fmt: fmtPct },
  { key: 'net_debt', label: 'Net Debt', fmt: fmtMoney },
  { key: 'net_debt_to_ebitda', label: 'Net Debt / EBITDA', fmt: fmtRatio },
  { key: 'interest_coverage', label: 'Interest Coverage', fmt: fmtRatio },
  { key: 'effective_tax_rate', label: 'Eff. Tax Rate', fmt: fmtPct },
  { key: 'nopat', label: 'NOPAT', fmt: fmtMoney },
  { key: 'invested_capital', label: 'Invested Capital', fmt: fmtMoney },
  { key: 'roic', label: 'ROIC', fmt: fmtPct },
]

function sortedYears(perYear) {
  if (!perYear?.length) return []
  return [...perYear]
    .filter((r) => r.ebitda != null || r.roic != null)
    .sort((a, b) => b.year - a.year)
    .slice(0, props.displayYears)
    .map((r) => r.year)
}

function perYearMap(perYear) {
  if (!perYear?.length) return {}
  return Object.fromEntries(perYear.map((r) => [r.year, r]))
}

function cellValue(year, row, yearMap) {
  return row.fmt(yearMap[year]?.[row.key])
}

function isNeg(year, key, yearMap) {
  const v = yearMap[year]?.[key]
  return v != null && v < 0
}
</script>

<template>
  <div data-testid="valuation-panel">
    <!-- ── EV Snapshot ──────────────────────────────────── -->
    <div class="gmr-snap" data-testid="val-snapshot">
      <div
        v-for="item in snapItems(data.valuation_snapshot)"
        :key="item.label"
        class="gmr-snap__cell"
        :data-testid="item.testid"
      >
        <div class="gmr-snap__label">{{ item.label }}</div>
        <div class="gmr-snap__value">{{ item.value }}</div>
      </div>
    </div>

    <!-- ── Summary averages ─────────────────────────────── -->
    <div class="gmr-fin__section-label">Averages</div>

    <div class="gmr-snap gmr-snap--wide" data-testid="val-summary">
      <div
        v-for="item in summaryItems(data.summary)"
        :key="item.label"
        class="gmr-snap__cell"
      >
        <div class="gmr-snap__label">{{ item.label }}</div>
        <div class="gmr-snap__value">{{ item.value }}</div>
      </div>
    </div>

    <!-- ── Per-year table ───────────────────────────────── -->
    <div class="gmr-fin__section-label">Per Year</div>

    <div class="gmr-ann-wrap" data-testid="val-annual-table">
      <table class="gmr-ann">
        <thead>
          <tr>
            <th>Metric</th>
            <th v-for="year in sortedYears(data.per_year)" :key="year">{{ year }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in perYearRows" :key="row.key">
            <td>{{ row.label }}</td>
            <td
              v-for="year in sortedYears(data.per_year)"
              :key="year"
              :class="{ 'gmr-ann__neg': isNeg(year, row.key, perYearMap(data.per_year)) }"
            >
              {{ cellValue(year, row, perYearMap(data.per_year)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
