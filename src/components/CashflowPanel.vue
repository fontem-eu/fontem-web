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

// ── Averages strip ────────────────────────────────────────────
const avgItems = computed(() => {
  const r = props.data?.ratios_summary
  if (!r) return []
  return [
    { label: 'cashflow_panel.avg_fcf_yield',  value: fmtPct(r.avg_fcf_yield) },
    { label: 'cashflow_panel.avg_div_yield', value: fmtPct(r.avg_dividend_yield) },
    { label: 'cashflow_panel.avg_op_margin', value: fmtPct(r.avg_operating_margin) },
  ]
})

// ── Per-year data ─────────────────────────────────────────────
const tableRows = [
  { key: 'operating_cashflow', label: 'cashflow_panel.op_cashflow',  fmt: fmtMoney },
  { key: 'capex',              label: 'cashflow_panel.capex',          fmt: fmtMoney },
  { key: 'free_cashflow',      label: 'cashflow_panel.free_cashflow',  fmt: fmtMoney },
  { key: 'fcf_per_share',      label: 'cashflow_panel.fcf_per_share',      fmt: (n) => n == null ? '—' : `$${Number(n).toFixed(2)}` },
  { key: 'dividend_per_share', label: 'cashflow_panel.div_per_share',     fmt: (n) => n == null ? '—' : `$${Number(n).toFixed(2)}` },
  { key: 'fcf_yield',          label: 'cashflow_panel.fcf_yield',      fmt: fmtPct },
  { key: 'dividend_yield',     label: 'cashflow_panel.div_yield',     fmt: fmtPct },
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
  const mutedCol  = style.getPropertyValue('--muted').trim()    || '#888'
  const gridCol   = style.getPropertyValue('--border').trim()   || '#2a2a2a'
  const accentCol = style.getPropertyValue('--accent').trim()   || '#3b82f6'
  const negCol    = style.getPropertyValue('--negative').trim() || '#ef4444'

  const chartData = [...props.data.per_year]
    .filter((d) => d.operating_cashflow != null || d.free_cashflow != null)
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
    .attr('data-testid', 'cashflow-chart-svg')

  const innerW = totalW - M.left - M.right
  const years  = chartData.map((d) => String(d.year))

  const x = d3.scaleBand()
    .domain(years)
    .range([M.left, M.left + innerW])
    .padding(0.2)

  // Y scale — accommodate negatives (CapEx is typically negative)
  const allVals = chartData.flatMap((d) =>
    [d.operating_cashflow, d.free_cashflow, d.capex].filter((v) => v != null)
  )
  const [yMin, yMax] = d3.extent(allVals)
  const pad = (yMax - yMin) * 0.1
  const y = d3.scaleLinear()
    .domain([Math.min(0, (yMin ?? 0) - pad), (yMax ?? 0) + pad])
    .range([M.top + H, M.top])
    .nice()

  // Zero line
  svg.append('line')
    .attr('x1', M.left).attr('x2', M.left + innerW)
    .attr('y1', y(0)).attr('y2', y(0))
    .attr('stroke', gridCol).attr('stroke-width', 1).attr('opacity', 0.8)

  // Grid
  y.ticks(4).forEach((tick) => {
    if (tick === 0) return
    svg.append('line')
      .attr('x1', M.left).attr('x2', M.left + innerW)
      .attr('y1', y(tick)).attr('y2', y(tick))
      .attr('stroke', gridCol).attr('stroke-width', 1).attr('opacity', 0.3)
  })

  const bw    = x.bandwidth()
  const third = bw / 3

  // Op Cashflow bars
  svg.append('g').selectAll('rect').data(chartData).join('rect')
    .attr('x', (d) => x(String(d.year)))
    .attr('y', (d) => { const v = d.operating_cashflow ?? 0; return v >= 0 ? y(v) : y(0) })
    .attr('width', third)
    .attr('height', (d) => Math.max(1, Math.abs(y(0) - y(d.operating_cashflow ?? 0))))
    .attr('fill', accentCol).attr('opacity', 0.7)

  // FCF bars
  svg.append('g').selectAll('rect').data(chartData).join('rect')
    .attr('x', (d) => x(String(d.year)) + third)
    .attr('y', (d) => { const v = d.free_cashflow ?? 0; return v >= 0 ? y(v) : y(0) })
    .attr('width', third)
    .attr('height', (d) => Math.max(1, Math.abs(y(0) - y(d.free_cashflow ?? 0))))
    .attr('fill', '#22c55e').attr('opacity', 0.75)

  // CapEx bars (usually negative)
  svg.append('g').selectAll('rect').data(chartData).join('rect')
    .attr('x', (d) => x(String(d.year)) + third * 2)
    .attr('y', (d) => { const v = d.capex ?? 0; return v >= 0 ? y(v) : y(0) })
    .attr('width', third)
    .attr('height', (d) => Math.max(1, Math.abs(y(0) - y(d.capex ?? 0))))
    .attr('fill', negCol).attr('opacity', 0.65)

  // Left Y axis
  svg.append('g')
    .attr('transform', `translate(${M.left},0)`)
    .call(
      d3.axisLeft(y)
        .ticks(4)
        .tickFormat((d) => {
          const a = Math.abs(d)
          const s = d < 0 ? '-' : ''
          if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(0)}T`
          if (a >= 1e9)  return `${s}$${(a / 1e9).toFixed(0)}B`
          if (a >= 1e6)  return `${s}$${(a / 1e6).toFixed(0)}M`
          return `${s}$${a}`
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
    { col: accentCol, opacity: 0.7,  label: 'Op. CF' },
    { col: '#22c55e', opacity: 0.75, label: 'FCF'    },
    { col: negCol,    opacity: 0.65, label: 'CapEx'  },
  ]
  legItems.forEach((item, i) => {
    const lx = M.left + i * 68
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
  <div data-testid="cashflow-panel">
    <!-- Averages -->
    <div class="gmr-snap gmr-snap--wide" data-testid="cashflow-averages">
      <div v-for="item in avgItems" :key="item.label" class="gmr-snap__cell">
        <div class="gmr-snap__label">{{ $t(item.label) }}</div>
        <div class="gmr-snap__value">{{ item.value }}</div>
      </div>
    </div>

    <!-- Chart -->
    <div class="gmr-fin__section-label">{{ $t('cashflow.cash_flow') }}</div>
    <div ref="containerRef" class="cashflow-chart-wrap" data-testid="cashflow-chart"></div>

    <!-- Per year table -->
    <div class="gmr-fin__section-label">{{ $t('app.per_year') }}</div>
    <div class="gmr-ann-wrap" data-testid="cashflow-table">
      <table class="gmr-ann">
        <thead>
          <tr>
            <th>{{ $t('app.metric') }}</th>
            <th v-for="year in sortedYears" :key="year">{{ year }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableRows" :key="row.key">
            <td>{{ $t(row.label) }}</td>
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
.cashflow-chart-wrap {
  width: 100%;
  overflow: hidden;
}
.cashflow-chart-wrap svg {
  display: block;
  width: 100%;
}
</style>
