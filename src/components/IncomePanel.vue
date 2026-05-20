<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'
import { fmtMoney, fmtPrice } from '../utils/format.js'

const props = defineProps({
  data:         { type: Object, required: true },
  displayYears: { type: Number, default: 10 },
})

function fmtPct(n) {
  if (n == null) return '—'
  return `${Number(n).toFixed(1)}%`
}

function fmtRatio(n, decimals = 1) {
  return n == null ? '—' : Number(n).toFixed(decimals)
}

// ── Averages strip ────────────────────────────────────────────
const avgItems = computed(() => {
  const r = props.data?.ratios_summary
  if (!r) return []
  return [
    { label: 'Avg P/E',           value: fmtRatio(r.avg_pe) },
    { label: 'Avg P/S',           value: fmtRatio(r.avg_ps) },
    { label: 'Avg Rev. Growth',   value: fmtPct(r.avg_revenue_growth) },
    { label: 'Avg EPS Growth',    value: fmtPct(r.avg_earnings_growth) },
    { label: 'Avg Gross Margin',  value: fmtPct(r.avg_gross_margin) },
    { label: 'Avg Op. Margin',    value: fmtPct(r.avg_operating_margin) },
    { label: 'Avg Net Margin',    value: fmtPct(r.avg_npm) },
  ]
})

// ── Per-year data ─────────────────────────────────────────────
const tableRows = [
  { key: 'avg_price',        label: 'Avg Price',       fmt: fmtPrice },
  { key: 'revenue',          label: 'Revenue',          fmt: fmtMoney },
  { key: 'gross_profit',     label: 'Gross Profit',     fmt: fmtMoney },
  { key: 'operating_income', label: 'Op. Income',       fmt: fmtMoney },
  { key: 'net_income',       label: 'Net Income',       fmt: fmtMoney },
  { key: 'eps',              label: 'EPS',              fmt: (n) => n == null ? '—' : `$${Number(n).toFixed(2)}` },
  { key: 'gross_margin',     label: 'Gross Margin',     fmt: fmtPct },
  { key: 'operating_margin', label: 'Op. Margin',       fmt: fmtPct },
  { key: 'npm',              label: 'Net Margin',       fmt: fmtPct },
  { key: 'revenue_growth',   label: 'Rev. Growth',      fmt: fmtPct },
  { key: 'earnings_growth',  label: 'Earnings Growth',  fmt: fmtPct },
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

// ── Chart (D3) ────────────────────────────────────────────────
const containerRef = ref(null)

function drawChart() {
  const el = containerRef.value
  if (!el || !props.data?.per_year?.length) return

  d3.select(el).selectAll('*').remove()

  const style     = getComputedStyle(document.documentElement)
  const mutedCol  = style.getPropertyValue('--muted').trim()   || '#888'
  const gridCol   = style.getPropertyValue('--border').trim()  || '#2a2a2a'
  const accentCol = style.getPropertyValue('--accent').trim()  || '#3b82f6'
  const negCol    = style.getPropertyValue('--negative').trim() || '#ef4444'

  // Chronological order for the chart
  const chartData = [...props.data.per_year]
    .filter((d) => d.revenue != null)
    .sort((a, b) => a.year - b.year)
    .slice(-props.displayYears)

  if (!chartData.length) return

  const totalW = el.clientWidth || 600
  const M      = { top: 20, right: 52, bottom: 28, left: 62 }
  const H      = 200
  const totalH = M.top + H + M.bottom

  const svg = d3.select(el)
    .append('svg')
    .attr('width', totalW)
    .attr('height', totalH)
    .attr('data-testid', 'income-chart-svg')

  const innerW = totalW - M.left - M.right
  const years  = chartData.map((d) => String(d.year))

  const x = d3.scaleBand()
    .domain(years)
    .range([M.left, M.left + innerW])
    .padding(0.25)

  // Revenue Y axis (left)
  const maxRev = d3.max(chartData, (d) => d.revenue ?? 0)
  const yRev = d3.scaleLinear()
    .domain([0, maxRev * 1.1])
    .range([M.top + H, M.top])
    .nice()

  // Margin % Y axis (right, fixed 0–100)
  const yMgn = d3.scaleLinear()
    .domain([0, 100])
    .range([M.top + H, M.top])

  // Grid lines
  yRev.ticks(4).forEach((tick) => {
    svg.append('line')
      .attr('x1', M.left).attr('x2', M.left + innerW)
      .attr('y1', yRev(tick)).attr('y2', yRev(tick))
      .attr('stroke', gridCol).attr('stroke-width', 1).attr('opacity', 0.4)
  })

  // Revenue bars (full width, muted)
  svg.append('g')
    .selectAll('rect').data(chartData).join('rect')
    .attr('x', (d) => x(String(d.year)))
    .attr('y', (d) => yRev(d.revenue ?? 0))
    .attr('width', x.bandwidth())
    .attr('height', (d) => Math.max(0, yRev(0) - yRev(d.revenue ?? 0)))
    .attr('fill', mutedCol)
    .attr('opacity', 0.3)

  // Net Income bars (inner 60%, colored)
  const niOffset = x.bandwidth() * 0.2
  const niWidth  = x.bandwidth() * 0.6
  svg.append('g')
    .selectAll('rect').data(chartData).join('rect')
    .attr('x', (d) => x(String(d.year)) + niOffset)
    .attr('y', (d) => {
      const v = d.net_income ?? 0
      return v >= 0 ? yRev(v) : yRev(0)
    })
    .attr('width', niWidth)
    .attr('height', (d) => Math.max(1, Math.abs(yRev(0) - yRev(d.net_income ?? 0))))
    .attr('fill', (d) => (d.net_income ?? 0) >= 0 ? accentCol : negCol)
    .attr('opacity', 0.85)

  // Net Margin line (dashed, amber)
  const marginData = chartData.filter((d) => d.npm != null)
  if (marginData.length > 1) {
    const line = d3.line()
      .x((d) => x(String(d.year)) + x.bandwidth() / 2)
      .y((d) => yMgn(d.npm))
      .curve(d3.curveMonotoneX)
    svg.append('path')
      .datum(marginData)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,2')
      .attr('d', line)
  }

  // Left Y axis (revenue)
  svg.append('g')
    .attr('transform', `translate(${M.left},0)`)
    .call(
      d3.axisLeft(yRev)
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

  // Right Y axis (margin %)
  svg.append('g')
    .attr('transform', `translate(${M.left + innerW},0)`)
    .call(
      d3.axisRight(yMgn)
        .ticks(4)
        .tickFormat((d) => `${d}%`)
        .tickSize(0)
    )
    .call((g) => g.select('.domain').remove())
    .call((g) => g.selectAll('text').attr('fill', '#f59e0b').attr('font-size', 10).attr('dx', 4))

  // X axis
  svg.append('g')
    .attr('transform', `translate(0,${M.top + H + 4})`)
    .call(d3.axisBottom(x).tickSize(0))
    .call((g) => g.select('.domain').remove())
    .call((g) => g.selectAll('text').attr('fill', mutedCol).attr('font-size', 10).attr('dy', 12))

  // Legend
  const legItems = [
    { col: mutedCol,  opacity: 0.3,  label: 'Revenue',     type: 'rect' },
    { col: accentCol, opacity: 0.85, label: 'Net Income',  type: 'rect' },
    { col: '#f59e0b', opacity: 1,    label: 'Net Margin%', type: 'line' },
  ]
  legItems.forEach((item, i) => {
    const lx = M.left + i * 88
    if (item.type === 'rect') {
      svg.append('rect')
        .attr('x', lx).attr('y', M.top - 14)
        .attr('width', 10).attr('height', 10)
        .attr('fill', item.col).attr('opacity', item.opacity)
    } else {
      svg.append('line')
        .attr('x1', lx).attr('x2', lx + 10)
        .attr('y1', M.top - 9).attr('y2', M.top - 9)
        .attr('stroke', item.col).attr('stroke-width', 1.5).attr('stroke-dasharray', '3,2')
    }
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
  <div data-testid="income-panel">
    <!-- Averages -->
    <div class="gmr-snap gmr-snap--wide" data-testid="income-averages">
      <div v-for="item in avgItems" :key="item.label" class="gmr-snap__cell">
        <div class="gmr-snap__label">{{ item.label }}</div>
        <div class="gmr-snap__value">{{ item.value }}</div>
      </div>
    </div>

    <!-- Chart -->
    <div class="gmr-fin__section-label">Revenue &amp; Net Income</div>
    <div ref="containerRef" class="income-chart-wrap" data-testid="income-chart"></div>

    <!-- Per year table -->
    <div class="gmr-fin__section-label">Per Year</div>
    <div class="gmr-ann-wrap" data-testid="income-table">
      <table class="gmr-ann">
        <thead>
          <tr>
            <th>Metric</th>
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
.income-chart-wrap {
  width: 100%;
  overflow: hidden;
}
.income-chart-wrap svg {
  display: block;
  width: 100%;
}
</style>
