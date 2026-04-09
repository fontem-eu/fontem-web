<script setup>
/**
 * Horizontal bar chart for ranked data (countries, categories, etc.)
 * Props: data: [{label, value}], color, maxBars, formatValue
 */
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  data: { type: Array, required: true },
  color: { type: String, default: null },
  maxBars: { type: Number, default: 15 },
  height: { type: Number, default: 0 },  // 0 = auto from data length
  formatValue: { type: Function, default: (v) => v.toLocaleString() },
})

const containerRef = ref(null)

function draw() {
  const el = containerRef.value
  if (!el || !props.data || props.data.length === 0) return

  const items = props.data.slice(0, props.maxBars)
  const barH = 24
  const gap = 4
  const M = { top: 5, right: 50, bottom: 5, left: 120 }
  const width = el.clientWidth
  const height = props.height || items.length * (barH + gap) + M.top + M.bottom
  const innerW = width - M.left - M.right
  const barColor = props.color || getComputedStyle(el).getPropertyValue('--accent')?.trim() || '#2563eb'

  d3.select(el).selectAll('*').remove()

  const svg = d3.select(el)
    .append('svg')
    .attr('width', width)
    .attr('height', height)

  const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

  const x = d3.scaleLinear()
    .domain([0, d3.max(items, (d) => d.value)])
    .range([0, innerW])

  items.forEach((d, i) => {
    const y = i * (barH + gap)

    // Label
    g.append('text')
      .attr('x', -5)
      .attr('y', y + barH / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--text, #333)')
      .style('font-size', '11px')
      .text(d.label.length > 18 ? d.label.slice(0, 16) + '...' : d.label)

    // Bar
    g.append('rect')
      .attr('x', 0)
      .attr('y', y)
      .attr('width', x(d.value))
      .attr('height', barH)
      .attr('fill', barColor)
      .attr('rx', 3)
      .attr('opacity', 0.8)

    // Value
    g.append('text')
      .attr('x', x(d.value) + 5)
      .attr('y', y + barH / 2)
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--muted, #999)')
      .style('font-size', '10px')
      .text(props.formatValue(d.value))
  })
}

let resizeObs
onMounted(() => {
  resizeObs = new ResizeObserver(() => draw())
  if (containerRef.value) resizeObs.observe(containerRef.value)
})
onBeforeUnmount(() => { if (resizeObs) resizeObs.disconnect() })
watch(() => props.data, () => nextTick(draw), { deep: true })
</script>

<template>
  <div ref="containerRef" class="hbc" />
</template>

<style scoped>
.hbc { width: 100%; }
</style>
