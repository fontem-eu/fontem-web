<script setup>
/**
 * Time-series bar chart with Grafana-style timespan selector.
 *
 * Uses Canvas for rendering (fast, no DOM overhead). Aggregation is
 * handled by the shared timeSeriesAggregation module.
 *
 * Props:
 *   data: Array of { date: string (ISO), value: number }
 *   color: bar color (default: accent)
 *   height: chart height in px (default: 300)
 *   valueLabel: y-axis label (default: "Count")
 *   formatValue: optional formatter for tooltip values
 */
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  aggregateData,
  formatDateLabel,
} from './timeSeriesAggregation.js'

const props = defineProps({
  data: { type: Array, required: true },
  color: { type: String, default: null },
  height: { type: Number, default: 300 },
  valueLabel: { type: String, default: 'Count' },
  formatValue: { type: Function, default: (v) => v.toLocaleString() },
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
  { key: 'all', label: 'zoomable_bar_chart.all', months: null },
]

const GRANULARITIES = [
  { key: 'day', label: 'zoomable_bar_chart.day' },
  { key: 'week', label: 'zoomable_bar_chart.week' },
  { key: 'month', label: 'zoomable_bar_chart.month' },
  { key: 'year', label: 'zoomable_bar_chart.year' },
]

// Filter data by selected timespan
const filteredData = computed(() => {
  if (!props.data || props.data.length === 0) return []
  const span = TIMESPANS.find(t => t.key === timespan.value)
  if (!span || !span.months) return props.data
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - span.months)
  const iso = cutoff.toISOString()
  return props.data.filter(d => d.date >= iso)
})

// Aggregated bars
const bars = computed(() => {
  if (filteredData.value.length === 0) return []
  return aggregateData(filteredData.value, granularity.value)
})

// Auto-select sensible granularity when timespan changes
watch(timespan, (ts) => {
  const months = TIMESPANS.find(t => t.key === ts)?.months
  if (!months || months <= 6) granularity.value = 'day'
  else if (months <= 24) granularity.value = 'month'
  else granularity.value = 'year'
})

// Canvas state for hit detection
let barRects = []

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

  const data = bars.value
  if (data.length === 0) return

  const innerW = width - MARGIN.left - MARGIN.right
  const innerH = height - MARGIN.top - MARGIN.bottom

  const xMin = data[0].key.getTime()
  const xMax = data[data.length - 1].key.getTime()
  const xSpan = xMax - xMin || 1
  const yMax = Math.max(...data.map(d => d.value)) * 1.1 || 1

  const xScale = (t) => MARGIN.left + ((t - xMin) / xSpan) * innerW
  const yScale = (v) => MARGIN.top + innerH - (v / yMax) * innerH

  // Bar geometry
  const barW = Math.max(1, (innerW / data.length) * 0.7)
  const barColor = props.color || getComputedStyle(container).getPropertyValue('--accent')?.trim() || '#2563eb'

  barRects = []
  ctx.fillStyle = barColor
  ctx.globalAlpha = 0.85
  for (const d of data) {
    const x = xScale(d.key.getTime()) - barW / 2
    const y = yScale(d.value)
    const h = MARGIN.top + innerH - y
    ctx.fillRect(x, y, barW, h)
    barRects.push({ x, y, w: barW, h, data: d })
  }
  ctx.globalAlpha = 1

  // Y-axis ticks
  ctx.fillStyle = getComputedStyle(container).getPropertyValue('--muted')?.trim() || '#999'
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  const yTicks = 5
  for (let i = 0; i <= yTicks; i++) {
    const v = (yMax / yTicks) * i
    const y = yScale(v)
    ctx.fillText(formatCompact(v), MARGIN.left - 8, y)
    // Grid line
    ctx.strokeStyle = getComputedStyle(container).getPropertyValue('--border')?.trim() || '#eee'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(MARGIN.left, y)
    ctx.lineTo(width - MARGIN.right, y)
    ctx.stroke()
  }

  // X-axis labels
  ctx.fillStyle = getComputedStyle(container).getPropertyValue('--muted')?.trim() || '#999'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const labelEvery = Math.max(1, Math.floor(data.length / 10))
  for (let i = 0; i < data.length; i += labelEvery) {
    const d = data[i]
    ctx.fillText(formatDateLabel(d.key, granularity.value), xScale(d.key.getTime()), MARGIN.top + innerH + 8)
  }

  // Y-axis label
  ctx.save()
  ctx.translate(12, MARGIN.top + innerH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = '11px sans-serif'
  ctx.fillText(props.valueLabel, 0, 0)
  ctx.restore()
}

function formatCompact(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return Math.round(v).toString()
}

function onMouseMove(event) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const mx = event.clientX - rect.left
  const my = event.clientY - rect.top
  for (const bar of barRects) {
    if (mx >= bar.x && mx <= bar.x + bar.w && my >= bar.y && my <= bar.y + bar.h) {
      tooltip.value = {
        x: event.offsetX,
        y: event.offsetY - 10,
        label: formatDateLabel(bar.data.key, granularity.value),
        value: props.formatValue(bar.data.value),
      }
      return
    }
  }
  tooltip.value = null
}

function onMouseLeave() {
  tooltip.value = null
}

// Render on data/config changes
watch(bars, () => nextTick(render))

let resizeObserver
onMounted(() => {
  resizeObserver = new ResizeObserver(() => render())
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})
onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
})
</script>

<template>
  <div class="tbc-wrap">
    <div class="tbc-controls">
      <div class="tbc-timespans">
        <button
          v-for="t in TIMESPANS"
          :key="t.key"
          :class="['tbc-btn', { active: timespan === t.key }]"
          @click="timespan = t.key"
        >{{ $t(t.label) }}</button>
      </div>
      <select v-model="granularity" class="tbc-select">
        <option v-for="g in GRANULARITIES" :key="g.key" :value="g.key">{{ $t(g.label) }}</option>
      </select>
    </div>
    <div ref="containerRef" class="tbc-chart" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
      <canvas ref="canvasRef" />
    </div>
    <div
      v-if="tooltip"
      class="tbc-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      <div class="tbc-tt-label">{{ tooltip.label }}</div>
      <div class="tbc-tt-value">{{ tooltip.value }}</div>
    </div>
    <div v-if="!data || data.length === 0" class="tbc-empty">{{ $t('app.no_data_available') }}</div>
  </div>
</template>

<style scoped>
.tbc-wrap { position: relative; }
.tbc-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 0 0.5rem;
}
.tbc-timespans { display: flex; gap: 2px; }
.tbc-btn {
  padding: 0.2rem 0.5rem;
  font-size: 0.7rem;
  border: 1px solid var(--border, #ddd);
  background: var(--bg, #fff);
  color: var(--muted, #999);
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s;
}
.tbc-btn.active {
  background: var(--accent, #2563eb);
  color: #fff;
  border-color: var(--accent, #2563eb);
}
.tbc-btn:hover:not(.active) { border-color: var(--accent, #2563eb); color: var(--text); }
.tbc-select {
  font-size: 0.7rem;
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--border, #ddd);
  border-radius: 3px;
  background: var(--bg, #fff);
  color: var(--text);
  cursor: pointer;
}
.tbc-chart { width: 100%; }
.tbc-chart canvas { display: block; }
.tbc-empty { text-align: center; padding: 3rem; color: var(--muted); font-size: 0.85rem; }
.tbc-tooltip {
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
.tbc-tt-label { color: var(--muted); font-size: 0.65rem; }
.tbc-tt-value { font-weight: 600; color: var(--text); }
</style>
