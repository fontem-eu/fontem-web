<script setup>
/**
 * Zoomable time-series line chart — sibling of ZoomableBarChart.
 *
 * Reuses the shared aggregation helpers (bucket selection, date
 * grouping, axis labels) so both chart types degrade identically
 * as you zoom out (daily → weekly → monthly → yearly).
 *
 * Props:
 *   series: [{ name, color, data: [{date, value}] }]
 *   height: chart height in px (default: 300)
 *   valueLabel: y-axis label (default: "Value")
 *   formatValue: tooltip number formatter
 *   showLegend: render legend above chart (default: true)
 */
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import * as d3 from 'd3'
import {
  getBucket,
  aggregateData,
  formatDateLabel,
  tickFormat,
  bucketLabel,
} from './timeSeriesAggregation.js'

const props = defineProps({
  series: { type: Array, required: true }, // [{name, color, data: [{date, value}]}]
  height: { type: Number, default: 300 },
  valueLabel: { type: String, default: 'Value' },
  formatValue: { type: Function, default: (v) => v.toLocaleString() },
  showLegend: { type: Boolean, default: true },
})

const containerRef = ref(null)
const tooltip = ref(null)

const MARGIN = { top: 20, right: 20, bottom: 40, left: 60 }

let currentTransform = d3.zoomIdentity

const hasAnyPoints = computed(
  () => Array.isArray(props.series) && props.series.some((s) => s.data && s.data.length > 0),
)

function resolveColor(el, s, fallbackVar) {
  if (s.color) return s.color
  const v = getComputedStyle(el).getPropertyValue(fallbackVar)?.trim()
  return v || '#2563eb'
}

function draw() {
  const el = containerRef.value
  if (!el || !hasAnyPoints.value) return

  const width = el.clientWidth
  const innerW = width - MARGIN.left - MARGIN.right
  const innerH = props.height - MARGIN.top - MARGIN.bottom

  // Pool every point across series to decide a single aggregation bucket
  // so both lines stay aligned on the x-axis.
  const pooled = props.series.flatMap((s) => s.data || [])
  const bucket = getBucket(pooled, innerW, currentTransform.k)

  // Aggregate each series independently at the chosen bucket
  const aggregatedSeries = props.series.map((s, i) => ({
    name: s.name,
    color: resolveColor(el, s, i === 0 ? '--accent' : '--muted'),
    points: aggregateData(s.data || [], bucket),
  })).filter((s) => s.points.length > 0)

  if (aggregatedSeries.length === 0) return

  // Shared x-domain across series
  const allKeys = aggregatedSeries.flatMap((s) => s.points.map((p) => p.key))
  const xDomain = d3.extent(allKeys)
  const padMs = (xDomain[1] - xDomain[0]) * 0.01 || 86400000
  const xScale = d3.scaleTime()
    .domain([new Date(xDomain[0].getTime() - padMs), new Date(xDomain[1].getTime() + padMs)])
    .range([0, innerW])

  const yMax = d3.max(aggregatedSeries, (s) => d3.max(s.points, (p) => p.value)) || 1
  const yScale = d3.scaleLinear()
    .domain([0, yMax * 1.1])
    .nice()
    .range([innerH, 0])

  d3.select(el).selectAll('*').remove()

  const clipId = `clip-${Math.random().toString(36).slice(2)}`

  const svg = d3.select(el)
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

  const xAxisG = g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(
      d3.axisBottom(xScale)
        .ticks(Math.min(Math.max(...aggregatedSeries.map((s) => s.points.length)), 12))
        .tickFormat(d3.timeFormat(tickFormat(bucket))),
    )
  xAxisG.selectAll('text').attr('fill', 'var(--muted, #999)').style('font-size', '10px')
  xAxisG.selectAll('line, path').attr('stroke', 'var(--border, #ddd)')

  const yAxisG = g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format('~s')))
  yAxisG.selectAll('text').attr('fill', 'var(--muted, #999)').style('font-size', '10px')
  yAxisG.selectAll('line, path').attr('stroke', 'var(--border, #ddd)')

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -45)
    .attr('x', -innerH / 2)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--muted, #999)')
    .style('font-size', '11px')
    .text(props.valueLabel)

  const plot = g.append('g').attr('clip-path', `url(#${clipId})`)
  const rescaledX = currentTransform.rescaleX(xScale)

  const lineGen = d3.line()
    .x((d) => rescaledX(d.key))
    .y((d) => yScale(d.value))
    .curve(d3.curveMonotoneX)

  for (const s of aggregatedSeries) {
    plot.append('path')
      .datum(s.points)
      .attr('fill', 'none')
      .attr('stroke', s.color)
      .attr('stroke-width', 2)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('d', lineGen)

    plot.selectAll(null)
      .data(s.points)
      .join('circle')
      .attr('cx', (d) => rescaledX(d.key))
      .attr('cy', (d) => yScale(d.value))
      .attr('r', 3)
      .attr('fill', s.color)
      .attr('stroke', 'var(--bg, #fff)')
      .attr('stroke-width', 1)
      .on('mouseenter', (event, d) => {
        tooltip.value = {
          x: event.offsetX,
          y: event.offsetY - 10,
          label: formatDateLabel(d.key, bucket),
          value: `${s.name}: ${props.formatValue(d.value)}`,
        }
        d3.select(event.target).attr('r', 5)
      })
      .on('mouseleave', (event) => {
        tooltip.value = null
        d3.select(event.target).attr('r', 3)
      })
  }

  const totalPoints = d3.sum(aggregatedSeries, (s) => s.points.length)
  const maxZoom = Math.max(2, totalPoints / 5)
  const zoomBehavior = d3.zoom()
    .scaleExtent([0.5, maxZoom])
    .translateExtent([[0, 0], [innerW, innerH]])
    .on('zoom', (event) => {
      currentTransform = event.transform
      draw()
    })

  svg.call(zoomBehavior)
  if (currentTransform !== d3.zoomIdentity) {
    svg.call(zoomBehavior.transform, currentTransform)
  }

  svg.append('text')
    .attr('x', width - MARGIN.right - 5)
    .attr('y', MARGIN.top + 12)
    .attr('text-anchor', 'end')
    .attr('fill', 'var(--muted, #999)')
    .style('font-size', '10px')
    .text(bucketLabel(bucket))
}

let resizeObserver
onMounted(() => {
  resizeObserver = new ResizeObserver(() => draw())
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})
onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
})

watch(
  () => props.series,
  () => {
    currentTransform = d3.zoomIdentity
    nextTick(draw)
  },
  { deep: true },
)

const legendItems = computed(() => {
  const el = containerRef.value
  return props.series.map((s, i) => ({
    name: s.name,
    color: s.color || (el ? resolveColor(el, s, i === 0 ? '--accent' : '--muted') : '#2563eb'),
  }))
})
</script>

<template>
  <div class="zlc-wrap">
    <div v-if="showLegend && series && series.length > 0" class="zlc-legend">
      <span v-for="item in legendItems" :key="item.name" class="zlc-legend-item">
        <span class="zlc-swatch" :style="{ background: item.color }" />
        {{ item.name }}
      </span>
    </div>
    <div ref="containerRef" class="zlc-chart" />
    <div
      v-if="tooltip"
      class="zlc-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      <div class="zlc-tt-label">{{ tooltip.label }}</div>
      <div class="zlc-tt-value">{{ tooltip.value }}</div>
    </div>
    <div v-if="!hasAnyPoints" class="zlc-empty">No data available</div>
  </div>
</template>

<style scoped>
.zlc-wrap { position: relative; }
.zlc-chart { width: 100%; cursor: grab; }
.zlc-chart:active { cursor: grabbing; }
.zlc-empty { text-align: center; padding: 3rem; color: var(--muted); font-size: 0.85rem; }
.zlc-legend {
  display: flex;
  gap: 1rem;
  padding: 0.25rem 0 0.5rem;
  font-size: 0.75rem;
  color: var(--muted);
}
.zlc-legend-item { display: inline-flex; align-items: center; gap: 0.35rem; }
.zlc-swatch {
  display: inline-block;
  width: 12px;
  height: 2px;
  border-radius: 1px;
}
.zlc-tooltip {
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
.zlc-tt-label { color: var(--muted); font-size: 0.65rem; }
.zlc-tt-value { font-weight: 600; color: var(--text); }
</style>
