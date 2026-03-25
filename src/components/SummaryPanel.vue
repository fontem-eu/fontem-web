<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'
import { fetchPriceHistory, fetchFundamentals } from '../api/gmr.js'
import { fmtPrice, fmtMoney } from '../utils/format.js'

const props = defineProps({
  symbol: { type: String, required: true },
})

// ── State ──────────────────────────────────────────────────────
const containerRef = ref(null)
const bars         = ref([])
const period       = ref('3y')
const loading      = ref(false)
const hasError     = ref(false)
const companyName  = ref(null)
const exchange     = ref(null)
const currentPrice = ref(null)
const priceChange  = ref(null)
const pctChange    = ref(null)
const tooltip      = ref(null)   // { date, open, high, low, close, volume, svgX, isUp }

const PERIODS = [
  { key: '1m',  label: '1M'  },
  { key: '6m',  label: '6M'  },
  { key: '1y',  label: '1Y'  },
  { key: '3y',  label: '3Y'  },
  { key: '5y',  label: '5Y'  },
  { key: '10y', label: '10Y' },
  { key: 'all', label: 'All' },
]

// ── Snapshot stats (from fundamentals) ──────────────────────────
const snapStats = ref(null)

async function loadSnapshot() {
  if (!props.symbol) return
  try {
    const d = await fetchFundamentals(props.symbol)
    snapStats.value = {
      marketCap: d.market_snapshot?.market_cap,
      beta:      d.market_snapshot?.beta,
      high52:    d.market_snapshot?.week_52_high,
      low52:     d.market_snapshot?.week_52_low,
      pe:        d.ratios_summary?.avg_pe,
      divYield:  d.ratios_summary?.avg_dividend_yield,
    }
  } catch { /* non-critical */ }
}

const statsBar = computed(() => {
  const s = snapStats.value
  if (!s) return []
  return [
    { label: 'Mkt Cap',  value: fmtMoney(s.marketCap) },
    { label: 'Avg P/E',  value: s.pe       != null ? Number(s.pe).toFixed(1)       : '—' },
    { label: 'Beta',     value: s.beta     != null ? Number(s.beta).toFixed(2)     : '—' },
    { label: 'Div Yld',  value: s.divYield != null ? `${Number(s.divYield).toFixed(1)}%` : '—' },
    { label: '52w High', value: fmtPrice(s.high52) },
    { label: '52w Low',  value: fmtPrice(s.low52) },
  ]
})

watch(() => props.symbol, loadSnapshot, { immediate: true })

// Module-level (not reactive) — set by drawChart, read by mouse handlers.
// Using plain variables avoids Vue overhead on every mousemove.
let _xScale      = null
let _chartData   = null
let _crosshairEl = null

// ── Data loading ────────────────────────────────────────────────

async function loadData() {
  if (!props.symbol) return
  loading.value  = true
  hasError.value = false
  bars.value     = []
  tooltip.value  = null
  try {
    const data = await fetchPriceHistory(props.symbol, period.value)
    bars.value    = data.bars ?? []
    companyName.value = data.name     ?? null
    exchange.value    = data.exchange ?? null

    if (bars.value.length > 0) {
      const last  = bars.value[bars.value.length - 1]
      const first = bars.value[0]
      currentPrice.value = last.close
      priceChange.value  = last.close - first.open
      pctChange.value    = ((last.close - first.open) / first.open) * 100
    } else {
      currentPrice.value = null
      priceChange.value  = null
      pctChange.value    = null
    }
    loading.value = false   // must be false before nextTick so the chart div renders
    await nextTick()
    drawChart()
  } catch {
    hasError.value = true
    loading.value  = false
  }
}

// ── Chart rendering ─────────────────────────────────────────────

function drawChart() {
  const el = containerRef.value
  if (!el || !bars.value.length) return

  tooltip.value  = null
  _xScale        = null
  _chartData     = null
  _crosshairEl   = null

  // Clear previous chart
  d3.select(el).selectAll('*').remove()

  // Read theme colours from CSS custom properties
  const style    = getComputedStyle(document.documentElement)
  const mutedCol = style.getPropertyValue('--muted').trim()   || '#888'
  const gridCol  = style.getPropertyValue('--border').trim()  || '#2a2a2a'
  const UP_COL   = '#22c55e'
  const DOWN_COL = style.getPropertyValue('--negative').trim() || '#ef4444'

  const totalW = el.clientWidth || 800
  const M      = { top: 12, right: 16, bottom: 30, left: 58 }
  const MAIN_H = 280
  const VOL_H  = 70
  const GAP    = 12
  const totalH = M.top + MAIN_H + GAP + VOL_H + M.bottom

  const svg = d3.select(el)
    .append('svg')
    .attr('width', totalW)
    .attr('height', totalH)
    .attr('data-testid', 'price-chart-svg')

  const innerW = totalW - M.left - M.right

  // Parse bar dates — stored for mouse handlers
  const data = bars.value.map((b) => ({
    ...b,
    ts: new Date(b.date + 'T12:00:00'),
  }))
  _chartData = data

  // ── X scale (time) ──────────────────────────────────────────
  const xDomain = d3.extent(data, (d) => d.ts)
  const x = d3.scaleTime().domain(xDomain).range([M.left, M.left + innerW])
  _xScale = x   // expose to mouse handlers

  const slotW   = innerW / data.length
  const candleW = Math.max(1, slotW * 0.7)

  // ── Price Y scale ───────────────────────────────────────────
  const priceMin = d3.min(data, (d) => d.low)
  const priceMax = d3.max(data, (d) => d.high)
  const pricePad = (priceMax - priceMin) * 0.05
  const yPrice = d3.scaleLinear()
    .domain([priceMin - pricePad, priceMax + pricePad])
    .range([M.top + MAIN_H, M.top])
    .nice()

  // ── Volume Y scale ──────────────────────────────────────────
  const volTop = M.top + MAIN_H + GAP
  const yVol = d3.scaleLinear()
    .domain([0, d3.max(data, (d) => d.volume)])
    .range([volTop + VOL_H, volTop])

  // ── Grid lines ──────────────────────────────────────────────
  const gridG = svg.append('g').attr('class', 'grid')
  yPrice.ticks(5).forEach((tick) => {
    gridG.append('line')
      .attr('x1', M.left).attr('x2', M.left + innerW)
      .attr('y1', yPrice(tick)).attr('y2', yPrice(tick))
      .attr('stroke', gridCol).attr('stroke-width', 1).attr('opacity', 0.4)
  })

  // ── Y axis (price) ──────────────────────────────────────────
  svg.append('g')
    .attr('transform', `translate(${M.left},0)`)
    .call(
      d3.axisLeft(yPrice)
        .ticks(5)
        .tickFormat((d) => `$${d3.format(',.0f')(d)}`)
        .tickSize(0)
    )
    .call((g) => g.select('.domain').remove())
    .call((g) => g.selectAll('text')
      .attr('fill', mutedCol).attr('font-size', 11).attr('dx', -4)
    )

  // ── X axis ──────────────────────────────────────────────────
  const xTickFmt = data.length <= 35  ? d3.timeFormat('%b %d')
    : data.length <= 200              ? d3.timeFormat('%b %y')
    :                                    d3.timeFormat('%Y')
  svg.append('g')
    .attr('transform', `translate(0,${M.top + MAIN_H + 4})`)
    .call(
      d3.axisBottom(x)
        .ticks(Math.min(6, data.length))
        .tickFormat(xTickFmt)
        .tickSize(0)
    )
    .call((g) => g.select('.domain').remove())
    .call((g) => g.selectAll('text')
      .attr('fill', mutedCol).attr('font-size', 11).attr('dy', 14)
    )

  // ── Crosshair (vertical dashed line, shown on hover) ────────
  const crosshairSel = svg.append('line')
    .attr('class', 'crosshair')
    .attr('y1', M.top)
    .attr('y2', M.top + MAIN_H + GAP + VOL_H)
    .attr('stroke', mutedCol)
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,3')
    .style('opacity', 0)
    .style('pointer-events', 'none')
  _crosshairEl = crosshairSel.node?.() ?? null

  // ── Candlesticks ────────────────────────────────────────────
  const candleG = svg.append('g').attr('class', 'candles')
  data.forEach((d) => {
    const cx    = x(d.ts)
    const isUp  = d.close >= d.open
    const col   = isUp ? UP_COL : DOWN_COL
    const bodyY = yPrice(Math.max(d.open, d.close))
    const bodyH = Math.max(1, Math.abs(yPrice(d.open) - yPrice(d.close)))

    candleG.append('line')
      .attr('x1', cx).attr('x2', cx)
      .attr('y1', yPrice(d.high)).attr('y2', yPrice(d.low))
      .attr('stroke', col)
      .attr('stroke-width', Math.max(1, candleW * 0.15))

    candleG.append('rect')
      .attr('x', cx - candleW / 2).attr('y', bodyY)
      .attr('width', candleW).attr('height', bodyH)
      .attr('fill', col).attr('stroke', col).attr('stroke-width', 0.5)
  })

  // ── Volume ───────────────────────────────────────────────────
  svg.append('text')
    .attr('x', M.left - 4).attr('y', volTop - 3)
    .attr('text-anchor', 'end')
    .attr('fill', mutedCol).attr('font-size', 10)
    .text('Vol')

  svg.append('g').attr('class', 'volume')
    .selectAll('rect').data(data).join('rect')
    .attr('x', (d) => x(d.ts) - candleW / 2)
    .attr('y', (d) => yVol(d.volume))
    .attr('width', candleW)
    .attr('height', (d) => Math.max(1, yVol(0) - yVol(d.volume)))
    .attr('fill', (d) => (d.close >= d.open ? UP_COL : DOWN_COL))
    .attr('opacity', 0.55)
}

// ── Mouse hover ─────────────────────────────────────────────────

function onChartMouseMove(event) {
  if (!_xScale || !_chartData || !_chartData.length) return
  const svg = containerRef.value?.querySelector('svg')

  const [mx] = d3.pointer(event, svg)
  const x0 = _xScale.invert(mx)

  const bisect  = d3.bisector((d) => d.ts).left
  const i       = bisect(_chartData, x0, 1)
  const d0      = _chartData[i - 1]
  const d1      = _chartData[i]
  const hovered = (d0 && d1)
    ? (Math.abs(x0 - d0.ts) <= Math.abs(x0 - d1.ts) ? d0 : d1)
    : (d0 ?? d1)
  if (!hovered) return

  const svgX = _xScale(hovered.ts)
  tooltip.value = {
    date:   hovered.date,
    open:   hovered.open,
    high:   hovered.high,
    low:    hovered.low,
    close:  hovered.close,
    volume: hovered.volume,
    svgX,
    isUp:   hovered.close >= hovered.open,
  }

  if (_crosshairEl) {
    _crosshairEl.setAttribute('x1', svgX)
    _crosshairEl.setAttribute('x2', svgX)
    _crosshairEl.style.opacity = '0.35'
  }
}

function onChartMouseLeave() {
  tooltip.value = null
  if (_crosshairEl) _crosshairEl.style.opacity = '0'
}

// Tooltip position: follow the candle, flip side near the right edge.
const tooltipStyle = computed(() => {
  if (!tooltip.value) return { display: 'none' }
  const w    = containerRef.value?.clientWidth || 800
  const svgX = Number(tooltip.value.svgX) || 0
  const TIP  = 128
  return {
    left: (svgX + TIP + 20 > w) ? `${svgX - TIP - 6}px` : `${svgX + 10}px`,
    top:  '8px',
  }
})

// ── Watchers ────────────────────────────────────────────────────

watch(() => [props.symbol, period.value], loadData, { immediate: true })

// ── Responsive resize ───────────────────────────────────────────

let resizeObs = null
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
    resizeObs = new ResizeObserver(() => { if (bars.value.length) drawChart() })
    resizeObs.observe(containerRef.value)
  }
})
onBeforeUnmount(() => {
  if (resizeObs) resizeObs.disconnect()
  _xScale = _chartData = _crosshairEl = null
})

// ── Formatting helpers ──────────────────────────────────────────

function fmtChange(n) {
  if (n == null) return ''
  return `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`
}

function fmtPct(n) {
  if (n == null) return ''
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function fmtVol(n) {
  if (n == null) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(Math.round(n))
}

function fmtDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}
</script>

<template>
  <div class="summary-panel" data-testid="summary-panel">

    <!-- ── Header ────────────────────────────────────────────── -->
    <div class="summary-header">
      <div class="summary-identity">
        <span class="summary-ticker" data-testid="summary-ticker">{{ symbol }}</span>
        <span
          v-if="companyName || exchange"
          class="summary-company"
          data-testid="summary-company"
        >
          {{ [companyName, exchange].filter(Boolean).join(' · ') }}
        </span>
      </div>

      <div v-if="currentPrice != null" class="summary-price-block">
        <span class="summary-price" data-testid="summary-price">{{ fmtPrice(currentPrice) }}</span>
        <span
          class="summary-change"
          :class="priceChange >= 0 ? 'up' : 'down'"
          data-testid="summary-change"
        >
          {{ fmtChange(priceChange) }} ({{ fmtPct(pctChange) }})
        </span>
      </div>
    </div>

    <!-- ── Period selector ───────────────────────────────────── -->
    <div class="summary-periods" data-testid="period-selector">
      <button
        v-for="p in PERIODS"
        :key="p.key"
        class="period-btn"
        :class="{ active: period === p.key }"
        :data-testid="`period-${p.key}`"
        @click="period = p.key"
      >
        {{ p.label }}
      </button>
    </div>

    <!-- ── Key stats bar ─────────────────────────────────────── -->
    <div v-if="statsBar.length" class="summary-stats" data-testid="summary-stats">
      <div v-for="item in statsBar" :key="item.label" class="summary-stat">
        <span class="summary-stat__label">{{ item.label }}</span>
        <span class="summary-stat__value">{{ item.value }}</span>
      </div>
    </div>

    <!-- ── Loading ───────────────────────────────────────────── -->
    <div v-if="loading" class="summary-state" data-testid="summary-loading">
      <span class="animate-pulse" style="color: var(--muted)">Loading…</span>
    </div>

    <!-- ── Error ─────────────────────────────────────────────── -->
    <div v-else-if="hasError" class="summary-state" data-testid="summary-error">
      <span style="color: var(--negative)">Could not load price data for {{ symbol }}.</span>
    </div>

    <!-- ── Chart ─────────────────────────────────────────────── -->
    <div
      v-else
      ref="containerRef"
      class="summary-chart-wrap"
      data-testid="chart-container"
      @mousemove="onChartMouseMove"
      @mouseleave="onChartMouseLeave"
    >
      <!-- Floating OHLCV tooltip -->
      <div
        v-if="tooltip"
        class="price-tooltip"
        :style="tooltipStyle"
        data-testid="price-tooltip"
      >
        <div class="tt-date" data-testid="tt-date">{{ fmtDate(tooltip.date) }}</div>
        <div class="tt-row">
          <span class="tt-label">O</span>
          <span class="tt-val" data-testid="tt-open">{{ fmtPrice(tooltip.open) }}</span>
        </div>
        <div class="tt-row">
          <span class="tt-label">H</span>
          <span class="tt-val tt-up" data-testid="tt-high">{{ fmtPrice(tooltip.high) }}</span>
        </div>
        <div class="tt-row">
          <span class="tt-label">L</span>
          <span class="tt-val tt-down" data-testid="tt-low">{{ fmtPrice(tooltip.low) }}</span>
        </div>
        <div class="tt-row">
          <span class="tt-label">C</span>
          <span
            class="tt-val"
            :class="tooltip.isUp ? 'tt-up' : 'tt-down'"
            data-testid="tt-close"
          >{{ fmtPrice(tooltip.close) }}</span>
        </div>
        <div class="tt-row">
          <span class="tt-label">Vol</span>
          <span class="tt-val" data-testid="tt-volume">{{ fmtVol(tooltip.volume) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.summary-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ── Header ───────────────────────── */
.summary-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.summary-identity {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.summary-ticker {
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
}

.summary-company {
  font-size: 0.72rem;
  color: var(--muted);
  letter-spacing: 0.02em;
}

/* ── Price block ──────────────────── */
.summary-price-block {
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
}

.summary-price {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.summary-change {
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.summary-change.up   { color: #22c55e; }
.summary-change.down { color: var(--negative); }

/* ── Period selector ──────────────── */
.summary-periods {
  display: flex;
  gap: 0.25rem;
}

.period-btn {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}

.period-btn:hover { border-color: var(--accent); color: var(--text); }
.period-btn.active { border-color: var(--accent); background: var(--accent); color: #fff; }

/* ── States ───────────────────────── */
.summary-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  font-size: 0.85rem;
}

/* ── Chart wrapper ────────────────── */
.summary-chart-wrap {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.summary-chart-wrap svg {
  display: block;
  width: 100%;
}

/* ── OHLCV Tooltip ────────────────── */
.price-tooltip {
  position: absolute;
  pointer-events: none;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 0.45rem 0.6rem;
  font-size: 0.72rem;
  line-height: 1.6;
  min-width: 118px;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0,0,0,0.18);
}

.tt-date {
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.2rem;
  font-size: 0.7rem;
  letter-spacing: 0.02em;
}

.tt-row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.tt-label {
  color: var(--muted);
  font-weight: 600;
  letter-spacing: 0.04em;
}

.tt-val {
  color: var(--text);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.tt-up   { color: #22c55e; }
.tt-down { color: var(--negative); }

/* ── Key stats bar ────────────────── */
.summary-stats {
  display: flex;
  flex-wrap: wrap;
  border: 1px solid var(--border);
}

.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1 1 auto;
  padding: 0.35rem 0.6rem;
  border-right: 1px solid var(--border);
  min-width: 72px;
}

.summary-stat:last-child {
  border-right: none;
}

.summary-stat__label {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}

.summary-stat__value {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
</style>
