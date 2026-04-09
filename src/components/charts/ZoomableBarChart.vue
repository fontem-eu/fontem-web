<script setup>
/**
 * Zoomable time-series bar chart powered by D3.
 *
 * Props:
 *   data: Array of { date: string (ISO), value: number }
 *   color: bar color (default: accent)
 *   height: chart height in px (default: 300)
 *   valueLabel: y-axis label (default: "Count")
 *   formatValue: optional formatter for tooltip values
 *
 * Zoom behavior:
 *   - Zoomed in: daily bars
 *   - Medium: weekly bars (ISO week)
 *   - Zoomed out: monthly bars
 *   - Far out: yearly bars
 */
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  data: { type: Array, required: true },        // [{date, value}]
  color: { type: String, default: null },       // null = use CSS --accent
  height: { type: Number, default: 300 },
  valueLabel: { type: String, default: 'Count' },
  formatValue: { type: Function, default: (v) => v.toLocaleString() },
})

const containerRef = ref(null)
const tooltip = ref(null)

const MARGIN = { top: 20, right: 20, bottom: 40, left: 60 }

let svg, xScale, yScale, barsGroup, zoomBehavior
let currentTransform = d3.zoomIdentity

function getBucket(data, pixelsPerBar) {
  // Decide aggregation level based on how much horizontal space each bar gets
  if (pixelsPerBar > 8) return 'day'
  if (pixelsPerBar > 3) return 'week'
  if (pixelsPerBar > 0.8) return 'month'
  return 'year'
}

function aggregateData(rawData, bucket) {
  if (!rawData || rawData.length === 0) return []

  const parsed = rawData.map((d) => ({
    date: new Date(d.date),
    value: d.value,
  }))

  if (bucket === 'day') return parsed.map((d) => ({ key: d.date, value: d.value }))

  const groups = d3.groups(parsed, (d) => {
    if (bucket === 'week') {
      const monday = d3.timeMonday(d.date)
      return monday.toISOString().slice(0, 10)
    }
    if (bucket === 'month') return `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`
    return String(d.date.getFullYear())
  })

  return groups.map(([key, items]) => ({
    key: bucket === 'day' ? items[0].date : new Date(bucket === 'year' ? `${key}-01-01` : `${key}-01`),
    value: d3.sum(items, (d) => d.value),
  }))
}

function formatDateLabel(date, bucket) {
  if (bucket === 'year') return d3.timeFormat('%Y')(date)
  if (bucket === 'month') return d3.timeFormat('%b %Y')(date)
  if (bucket === 'week') return `W${d3.timeFormat('%V')(date)} ${d3.timeFormat('%Y')(date)}`
  return d3.timeFormat('%d %b %Y')(date)
}

function draw() {
  const el = containerRef.value
  if (!el || !props.data || props.data.length === 0) return

  const width = el.clientWidth
  const innerW = width - MARGIN.left - MARGIN.right
  const innerH = props.height - MARGIN.top - MARGIN.bottom

  // Determine bucket based on zoom
  const totalDays = props.data.length
  const effectiveWidth = innerW * currentTransform.k
  const pixelsPerBar = effectiveWidth / totalDays
  const bucket = getBucket(props.data, pixelsPerBar)

  const aggregated = aggregateData(props.data, bucket)
  if (aggregated.length === 0) return

  const barColor = props.color || getComputedStyle(el).getPropertyValue('--accent')?.trim() || '#2563eb'

  // Scales
  const xDomain = d3.extent(aggregated, (d) => d.key)
  const padMs = (xDomain[1] - xDomain[0]) * 0.01 || 86400000
  xScale = d3.scaleTime()
    .domain([new Date(xDomain[0].getTime() - padMs), new Date(xDomain[1].getTime() + padMs)])
    .range([0, innerW])

  yScale = d3.scaleLinear()
    .domain([0, d3.max(aggregated, (d) => d.value) * 1.1])
    .nice()
    .range([innerH, 0])

  // Bar width based on bucket
  const barWidthRatio = { day: 0.8, week: 0.7, month: 0.6, year: 0.5 }
  const idealBarW = Math.max(1, (innerW / aggregated.length) * (barWidthRatio[bucket] || 0.7))

  // Clear and build SVG
  d3.select(el).selectAll('*').remove()

  const clipId = `clip-${Math.random().toString(36).slice(2)}`

  svg = d3.select(el)
    .append('svg')
    .attr('width', width)
    .attr('height', props.height)

  svg.append('defs')
    .append('clipPath')
    .attr('id', clipId)
    .append('rect')
    .attr('width', innerW)
    .attr('height', innerH)

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  // Axes
  const xAxisG = g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(Math.min(aggregated.length, 12)).tickFormat(d3.timeFormat(bucket === 'year' ? '%Y' : bucket === 'month' ? '%b %y' : '%d %b')))

  xAxisG.selectAll('text').attr('fill', 'var(--muted, #999)').style('font-size', '10px')
  xAxisG.selectAll('line, path').attr('stroke', 'var(--border, #ddd)')

  const yAxisG = g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format('~s')))

  yAxisG.selectAll('text').attr('fill', 'var(--muted, #999)').style('font-size', '10px')
  yAxisG.selectAll('line, path').attr('stroke', 'var(--border, #ddd)')

  // Y-axis label
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -45)
    .attr('x', -innerH / 2)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted, #999)')
    .style('font-size', '11px')
    .text(props.valueLabel)

  // Bars
  barsGroup = g.append('g')
    .attr('clip-path', `url(#${clipId})`)

  const rescaledX = currentTransform.rescaleX(xScale)

  barsGroup.selectAll('rect')
    .data(aggregated)
    .join('rect')
    .attr('x', (d) => rescaledX(d.key) - idealBarW / 2)
    .attr('y', (d) => yScale(d.value))
    .attr('width', Math.max(1, idealBarW))
    .attr('height', (d) => innerH - yScale(d.value))
    .attr('fill', barColor)
    .attr('rx', Math.min(2, idealBarW / 4))
    .attr('opacity', 0.85)
    .on('mouseenter', (event, d) => {
      tooltip.value = {
        x: event.offsetX,
        y: event.offsetY - 10,
        label: formatDateLabel(d.key, bucket),
        value: props.formatValue(d.value),
      }
      d3.select(event.target).attr('opacity', 1)
    })
    .on('mouseleave', (event) => {
      tooltip.value = null
      d3.select(event.target).attr('opacity', 0.85)
    })

  // Zoom
  zoomBehavior = d3.zoom()
    .scaleExtent([0.5, totalDays / 5])
    .translateExtent([[0, 0], [innerW, innerH]])
    .on('zoom', (event) => {
      currentTransform = event.transform
      draw()
    })

  svg.call(zoomBehavior)
  if (currentTransform !== d3.zoomIdentity) {
    svg.call(zoomBehavior.transform, currentTransform)
  }

  // Bucket indicator
  svg.append('text')
    .attr('x', width - MARGIN.right - 5)
    .attr('y', MARGIN.top + 12)
    .attr('text-anchor', 'end')
    .attr('fill', 'var(--muted, #999)')
    .style('font-size', '10px')
    .text(bucket === 'day' ? 'Daily' : bucket === 'week' ? 'Weekly' : bucket === 'month' ? 'Monthly' : 'Yearly')
}

let resizeObserver
onMounted(() => {
  resizeObserver = new ResizeObserver(() => draw())
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})
onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
})

watch(() => props.data, () => {
  currentTransform = d3.zoomIdentity
  nextTick(draw)
}, { deep: true })
</script>

<template>
  <div class="zbc-wrap">
    <div ref="containerRef" class="zbc-chart" />
    <div
      v-if="tooltip"
      class="zbc-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      <div class="zbc-tt-label">{{ tooltip.label }}</div>
      <div class="zbc-tt-value">{{ tooltip.value }}</div>
    </div>
    <div v-if="!data || data.length === 0" class="zbc-empty">No data available</div>
  </div>
</template>

<style scoped>
.zbc-wrap { position: relative; }
.zbc-chart { width: 100%; cursor: grab; }
.zbc-chart:active { cursor: grabbing; }
.zbc-empty { text-align: center; padding: 3rem; color: var(--muted); font-size: 0.85rem; }
.zbc-tooltip {
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
.zbc-tt-label { color: var(--muted); font-size: 0.65rem; }
.zbc-tt-value { font-weight: 600; color: var(--text); }
</style>
