<script setup>
/**
 * Time-series line chart with Grafana-style timespan selector.
 *
 * Canvas-based for performance. Supports multiple series with legend.
 *
 * Props:
 *   series: [{ name, color, data: [{date, value}] }]
 *   height: chart height in px (default: 300)
 *   valueLabel: y-axis label (default: "Value")
 *   formatValue: tooltip number formatter
 *   showLegend: render legend above chart (default: true)
 */
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  aggregateData,
  formatDateLabel,
} from './timeSeriesAggregation.js'

const props = defineProps({
  series: { type: Array, required: true },
  height: { type: Number, default: 300 },
  valueLabel: { type: String, default: 'Value' },
  formatValue: { type: Function, default: (v) => v.toLocaleString() },
  showLegend: { type: Boolean, default: true },
})

const containerRef = ref(null)
const canvasRef = ref(null)
const tooltip = ref(null)
const timespan = ref('all')
const granularity = ref('month')

const MARGIN = { top: 10, right: 15, bottom: 30, left: 55 }

const TIMESPANS = [
  { key: '6m', label: '6M', months: 6 },
  { key: '1y', label: '1Y', months: 12 },
  { key: '2y', label: '2Y', months: 24 },
  { key: '5y', label: '5Y', months: 60 },
  { key: 'all', label: 'All', months: null },
]

const GRANULARITIES = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
]

const hasAnyPoints = computed(
  () => Array.isArray(props.series) && props.series.some(s => s.data && s.data.length > 0),
)

const DEFAULT_COLORS = ['#2563eb', '#999', '#16a34a', '#dc2626', '#9333ea', '#ea580c']

function getColor(s, i) {
  return s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]
}

// Filter + aggregate each series
const processedSeries = computed(() => {
  if (!hasAnyPoints.value) return []
  const span = TIMESPANS.find(t => t.key === timespan.value)
  let cutoff = null
  if (span?.months) {
    const d = new Date()
    d.setMonth(d.getMonth() - span.months)
    cutoff = d.toISOString()
  }
  return props.series.map((s, i) => {
    const filtered = cutoff ? (s.data || []).filter(d => d.date >= cutoff) : (s.data || [])
    return {
      name: s.name,
      color: getColor(s, i),
      points: aggregateData(filtered, granularity.value),
    }
  }).filter(s => s.points.length > 0)
})

watch(timespan, (ts) => {
  const months = TIMESPANS.find(t => t.key === ts)?.months
  if (!months || months <= 6) granularity.value = 'day'
  else if (months <= 24) granularity.value = 'month'
  else granularity.value = 'year'
})

let hitPoints = []

function render() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  const dpr = window.devicePixelRatio || 1
  const width = container.clientWidth
  const height = props.height

  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  const data = processedSeries.value
  if (data.length === 0) return

  const innerW = width - MARGIN.left - MARGIN.right
  const innerH = height - MARGIN.top - MARGIN.bottom

  // Shared scales
  const allKeys = data.flatMap(s => s.points.map(p => p.key.getTime()))
  const xMin = Math.min(...allKeys)
  const xMax = Math.max(...allKeys)
  const xSpan = xMax - xMin || 1
  const yMax = Math.max(...data.flatMap(s => s.points.map(p => p.value))) * 1.1 || 1

  const xScale = (t) => MARGIN.left + ((t - xMin) / xSpan) * innerW
  const yScale = (v) => MARGIN.top + innerH - (v / yMax) * innerH

  // Grid
  const mutedColor = getComputedStyle(container).getPropertyValue('--muted')?.trim() || '#999'
  const borderColor = getComputedStyle(container).getPropertyValue('--border')?.trim() || '#eee'
  ctx.font = '10px sans-serif'
  ctx.textBaseline = 'middle'

  const yTicks = 5
  for (let i = 0; i <= yTicks; i++) {
    const v = (yMax / yTicks) * i
    const y = yScale(v)
    ctx.fillStyle = mutedColor
    ctx.textAlign = 'right'
    ctx.fillText(formatCompact(v), MARGIN.left - 8, y)
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(MARGIN.left, y)
    ctx.lineTo(width - MARGIN.right, y)
    ctx.stroke()
  }

  // X labels
  const allPts = data[0].points
  const labelEvery = Math.max(1, Math.floor(allPts.length / 10))
  ctx.fillStyle = mutedColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let i = 0; i < allPts.length; i += labelEvery) {
    ctx.fillText(formatDateLabel(allPts[i].key, granularity.value), xScale(allPts[i].key.getTime()), MARGIN.top + innerH + 8)
  }

  // Y label
  ctx.save()
  ctx.translate(12, MARGIN.top + innerH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = '11px sans-serif'
  ctx.fillStyle = mutedColor
  ctx.fillText(props.valueLabel, 0, 0)
  ctx.restore()

  // Lines + dots
  hitPoints = []
  for (const s of data) {
    ctx.strokeStyle = s.color
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (let i = 0; i < s.points.length; i++) {
      const px = xScale(s.points[i].key.getTime())
      const py = yScale(s.points[i].value)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
      hitPoints.push({ x: px, y: py, series: s.name, color: s.color, data: s.points[i] })
    }
    ctx.stroke()

    // Dots
    ctx.fillStyle = s.color
    for (const p of s.points) {
      const px = xScale(p.key.getTime())
      const py = yScale(p.value)
      ctx.beginPath()
      ctx.arc(px, py, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function formatCompact(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return Math.round(v).toString()
}

function onMouseMove(event) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect || hitPoints.length === 0) return
  const mx = event.clientX - rect.left
  const my = event.clientY - rect.top
  let closest = null
  let minDist = 20
  for (const hp of hitPoints) {
    const dist = Math.hypot(mx - hp.x, my - hp.y)
    if (dist < minDist) {
      minDist = dist
      closest = hp
    }
  }
  if (closest) {
    tooltip.value = {
      x: event.offsetX,
      y: event.offsetY - 10,
      label: formatDateLabel(closest.data.key, granularity.value),
      value: `${closest.series}: ${props.formatValue(closest.data.value)}`,
    }
  } else {
    tooltip.value = null
  }
}

function onMouseLeave() {
  tooltip.value = null
}

watch(processedSeries, () => nextTick(render))

let resizeObserver
onMounted(() => {
  resizeObserver = new ResizeObserver(() => render())
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})
onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
})

const legendItems = computed(() =>
  props.series.map((s, i) => ({ name: s.name, color: getColor(s, i) }))
)
</script>

<template>
  <div class="tlc-wrap">
    <div class="tlc-controls">
      <div class="tlc-timespans">
        <button
          v-for="t in TIMESPANS"
          :key="t.key"
          :class="['tlc-btn', { active: timespan === t.key }]"
          @click="timespan = t.key"
        >{{ t.label }}</button>
      </div>
      <select v-model="granularity" class="tlc-select">
        <option v-for="g in GRANULARITIES" :key="g.key" :value="g.key">{{ g.label }}</option>
      </select>
    </div>
    <div v-if="showLegend && series && series.length > 0" class="tlc-legend">
      <span v-for="item in legendItems" :key="item.name" class="tlc-legend-item">
        <span class="tlc-swatch" :style="{ background: item.color }" />
        {{ item.name }}
      </span>
    </div>
    <div ref="containerRef" class="tlc-chart" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
      <canvas ref="canvasRef" />
    </div>
    <div
      v-if="tooltip"
      class="tlc-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      <div class="tlc-tt-label">{{ tooltip.label }}</div>
      <div class="tlc-tt-value">{{ tooltip.value }}</div>
    </div>
    <div v-if="!hasAnyPoints" class="tlc-empty">{{ $t('app.no_data_available') }}</div>
  </div>
</template>

<style scoped>
.tlc-wrap { position: relative; }
.tlc-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 0 0.5rem;
}
.tlc-timespans { display: flex; gap: 2px; }
.tlc-btn {
  padding: 0.2rem 0.5rem;
  font-size: 0.7rem;
  border: 1px solid var(--border, #ddd);
  background: var(--bg, #fff);
  color: var(--muted, #999);
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s;
}
.tlc-btn.active {
  background: var(--accent, #2563eb);
  color: #fff;
  border-color: var(--accent, #2563eb);
}
.tlc-btn:hover:not(.active) { border-color: var(--accent, #2563eb); color: var(--text); }
.tlc-select {
  font-size: 0.7rem;
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--border, #ddd);
  border-radius: 3px;
  background: var(--bg, #fff);
  color: var(--text);
  cursor: pointer;
}
.tlc-chart { width: 100%; }
.tlc-chart canvas { display: block; }
.tlc-empty { text-align: center; padding: 3rem; color: var(--muted); font-size: 0.85rem; }
.tlc-legend {
  display: flex;
  gap: 1rem;
  padding: 0.25rem 0 0.5rem;
  font-size: 0.75rem;
  color: var(--muted);
}
.tlc-legend-item { display: inline-flex; align-items: center; gap: 0.35rem; }
.tlc-swatch { display: inline-block; width: 12px; height: 2px; border-radius: 1px; }
.tlc-tooltip {
  position: absolute;
  pointer-events: none;
  background: var(--bg, #fff);
  border: 1px solid var(--border, #ddd);
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font-size: 0.75rem;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  transform: translate(-50%, -100%);
  z-index: 10;
}
.tlc-tt-label { color: var(--muted); font-size: 0.65rem; }
.tlc-tt-value { font-weight: 600; color: var(--text); }
</style>
