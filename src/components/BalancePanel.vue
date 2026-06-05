<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'
import { fmtMoney } from '../utils/format.js'

const props = defineProps({
  data:         { type: Object, required: true },
  displayYears: { type: Number, default: 10 },
})

function fmtPct(n) {
  if (n == null) return '—'
  return `${Number(n).toFixed(1)}%`
}

function fmtRatio(n, decimals = 2) {
  return n == null ? '—' : Number(n).toFixed(decimals)
}

// ── Averages strip ────────────────────────────────────────────
const avgItems = computed(() => {
  const r = props.data?.ratios_summary
  if (!r) return []
  return [
    { label: 'Avg D/E',           value: fmtRatio(r.avg_debt_to_equity) },
    { label: 'Avg D/A',           value: fmtRatio(r.avg_debt_to_assets) },
    { label: 'Avg Current Ratio', value: fmtRatio(r.avg_current_ratio) },
    { label: 'Avg Quick Ratio',   value: fmtRatio(r.avg_quick_ratio) },
    { label: 'Avg ROE',           value: fmtPct(r.avg_roe) },
    { label: 'Avg ROA',           value: fmtPct(r.avg_roa) },
  ]
})

// ── Per-year data ─────────────────────────────────────────────
const tableRows = [
  { key: 'total_assets',         label: 'Total Assets',    fmt: fmtMoney },
  { key: 'total_liabilities',    label: 'Total Liabilities', fmt: fmtMoney },
  { key: 'equity',               label: 'Equity',           fmt: fmtMoney },
  { key: 'book_value_per_share', label: 'Book Value/Share', fmt: (n) => n == null ? '—' : `$${Number(n).toFixed(2)}` },
  { key: 'revenue_per_share',    label: 'Revenue/Share',    fmt: (n) => n == null ? '—' : `$${Number(n).toFixed(2)}` },
  { key: 'current_ratio',        label: 'Current Ratio',    fmt: (n) => fmtRatio(n) },
  { key: 'quick_ratio',          label: 'Quick Ratio',      fmt: (n) => fmtRatio(n) },
  { key: 'debt_to_equity',       label: 'D/E',              fmt: (n) => fmtRatio(n) },
  { key: 'debt_to_assets',       label: 'D/A',              fmt: (n) => fmtRatio(n) },
  { key: 'roe',                  label: 'ROE',              fmt: fmtPct },
  { key: 'roa',                  label: 'ROA',              fmt: fmtPct },
]

const sortedYears = computed(() => {
  if (!props.data?.per_year?.length) return []
  return [...props.data.per_year]
    .sort((a, b) => b.year - a.year)
    .slice(0, props.displayYears)
    .map((d) => d.year)
})

const yearMap = computed(() => {
  if (!props.data?.per_year?.length) return {}
  return Object.fromEntries(props.data.per_year.map((d) => [d.year, d]))
})

function cellValue(year, row) {
  return row.fmt(yearMap.value[year]?.[row.key])
}

function isNeg(year, key) {
  const v = yearMap.value[year]?.[key]
  return v != null && v < 0
}

// ── Chart (D3) — stacked bar: Equity + Liabilities ────────────
const containerRef = ref(null)

function drawChart() {
  const el = containerRef.value
  if (!el || !props.data?.per_year?.length) return

  d3.select(el).selectAll('*').remove()

  const style    = getComputedStyle(document.documentElement)
  const mutedCol = style.getPropertyValue('--muted').trim()    || '#888'
  const gridCol  = style.getPropertyValue('--border').trim()   || '#2a2a2a'
  const negCol   = style.getPropertyValue('--negative').trim() || '#ef4444'

  const chartData = [...props.data.per_year]
    .filter((d) => d.total_assets != null)
    .sort((a, b) => a.year - b.year)
    .slice(-props.displayYears)

  if (!chartData.length) return

  const totalW = el.clientWidth || 600
  const M      = { top: 20, right: 16, bottom: 28, left: 62 }
  const H      = 180
  const totalH = M.top + H + M.bottom

  const svg = d3.select(el)
    .append('svg')
    .attr('width', totalW)
    .attr('height', totalH)
    .attr('data-testid', 'balance-chart-svg')

  const innerW = totalW - M.left - M.right
  const years  = chartData.map((d) => String(d.year))

  const x = d3.scaleBand()
    .domain(years)
    .range([M.left, M.left + innerW])
    .padding(0.2)

  const maxAssets = d3.max(chartData, (d) => d.total_assets ?? 0)
  const y = d3.scaleLinear()
    .domain([0, (maxAssets ?? 0) * 1.1])
    .range([M.top + H, M.top])
    .nice()

  // Grid
  y.ticks(4).forEach((tick) => {
    svg.append('line')
      .attr('x1', M.left).attr('x2', M.left + innerW)
      .attr('y1', y(tick)).attr('y2', y(tick))
      .attr('stroke', gridCol).attr('stroke-width', 1).attr('opacity', 0.4)
  })

  // Stacked bars: liabilities (bottom) + equity (top)
  chartData.forEach((d) => {
    const bx   = x(String(d.year))
    const bw   = x.bandwidth()
    const liab = d.total_liabilities ?? 0
    const eq   = Math.max(0, d.equity ?? 0)
    const total = liab + eq

    // Liabilities segment (bottom portion of bar)
    svg.append('rect')
      .attr('x', bx).attr('y', y(total))
      .attr('width', bw)
      .attr('height', Math.max(0, y(0) - y(liab)))
      .attr('fill', negCol).attr('opacity', 0.4)

    // Equity segment (top portion, above liabilities)
    if (eq > 0) {
      svg.append('rect')
        .attr('x', bx).attr('y', y(total))
        .attr('width', bw)
        .attr('height', Math.max(0, y(liab) - y(total)))
        .attr('fill', '#22c55e').attr('opacity', 0.6)
    }
  })

  // Left Y axis
  svg.append('g')
    .attr('transform', `translate(${M.left},0)`)
    .call(
      d3.axisLeft(y)
        .ticks(4)
        .tickFormat((d) => {
          const a = Math.abs(d)
          if (a >= 1e12) return `$${(d / 1e12).toFixed(0)}T`
          if (a >= 1e9)  return `$${(d / 1e9).toFixed(0)}B`
          if (a >= 1e6)  return `$${(d / 1e6).toFixed(0)}M`
          return `$${d}`
        })
        .tickSize(0)
    )
    .call((g) => g.select('.domain').remove())
    .call((g) => g.selectAll('text').attr('fill', mutedCol).attr('font-size', 10).attr('dx', -4))

  // X axis
  svg.append('g')
    .attr('transform', `translate(0,${M.top + H + 4})`)
    .call(d3.axisBottom(x).tickSize(0))
    .call((g) => g.select('.domain').remove())
    .call((g) => g.selectAll('text').attr('fill', mutedCol).attr('font-size', 10).attr('dy', 12))

  // Legend
  const legItems = [
    { col: '#22c55e', opacity: 0.6, label: 'Equity'      },
    { col: negCol,    opacity: 0.4, label: 'Liabilities' },
  ]
  legItems.forEach((item, i) => {
    const lx = M.left + i * 80
    svg.append('rect')
      .attr('x', lx).attr('y', M.top - 14)
      .attr('width', 10).attr('height', 10)
      .attr('fill', item.col).attr('opacity', item.opacity)
    svg.append('text')
      .attr('x', lx + 13).attr('y', M.top - 5)
      .attr('fill', mutedCol).attr('font-size', 9)
      .text(item.label)
  })
}

watch(
  () => [props.data, props.displayYears],
  async () => { await nextTick(); drawChart() },
  { immediate: true }
)

let resizeObs = null
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
    resizeObs = new ResizeObserver(() => drawChart())
    resizeObs.observe(containerRef.value)
  }
})
onBeforeUnmount(() => {
  if (resizeObs) resizeObs.disconnect()
})
</script>

<template>
  <div data-testid="balance-panel">
    <!-- Averages -->
    <div class="gmr-snap gmr-snap--wide" data-testid="balance-averages">
      <div v-for="item in avgItems" :key="item.label" class="gmr-snap__cell">
        <div class="gmr-snap__label">{{ item.label }}</div>
        <div class="gmr-snap__value">{{ item.value }}</div>
      </div>
    </div>

    <!-- Chart -->
    <div class="gmr-fin__section-label">{{ $t('balance.capital_structure') }}</div>
    <div ref="containerRef" class="balance-chart-wrap" data-testid="balance-chart"></div>

    <!-- Per year table -->
    <div class="gmr-fin__section-label">{{ $t('app.per_year') }}</div>
    <div class="gmr-ann-wrap" data-testid="balance-table">
      <table class="gmr-ann">
        <thead>
          <tr>
            <th>{{ $t('app.metric') }}</th>
            <th v-for="year in sortedYears" :key="year">{{ year }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableRows" :key="row.key">
            <td>{{ row.label }}</td>
            <td
              v-for="year in sortedYears"
              :key="year"
              :class="{ 'gmr-ann__neg': isNeg(year, row.key) }"
            >{{ cellValue(year, row) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.balance-chart-wrap {
  width: 100%;
  overflow: hidden;
}
.balance-chart-wrap svg {
  display: block;
  width: 100%;
}
</style>
