<script setup>
/**
 * General multi-series line chart (SVG). Plots one shared x axis (numeric or
 * ordinal/categorical) against many y series, each in a fixed-order categorical
 * hue. Legend is always shown for ≥2 series; ≤4 series are also direct-labelled
 * at the line end so identity is never colour-alone. Crosshair + tooltip on
 * hover. Chrome (ink/grid/surface) reads the app's CSS theme tokens.
 *
 * Props:
 *   series: [{ name, color?, points: [{ x, y }] }]   // x number|string, y number
 *   xLabel, yLabel: axis captions
 *   xIsNumeric: boolean — linear x when true, evenly-spaced ordinal otherwise
 *   formatValue: (n) => string
 */
import { ref, computed } from 'vue'
import { categorical } from '../../utils/vizPalette.js'

const props = defineProps({
  series: { type: Array, default: () => [] },
  xLabel: { type: String, default: '' },
  yLabel: { type: String, default: 'Value' },
  xIsNumeric: { type: Boolean, default: false },
  formatValue: { type: Function, default: (v) => (v == null ? '—' : Number(v).toLocaleString()) },
})

const W = 760
const H = 340
const M = { top: 12, right: 16, bottom: 40, left: 62 }
const IW = W - M.left - M.right
const IH = H - M.top - M.bottom

const clean = computed(() => (props.series || [])
  .filter((s) => s && Array.isArray(s.points) && s.points.length)
  .map((s, i) => ({ name: s.name || `series ${i + 1}`, color: s.color || categorical(i), points: s.points })))

// Shared x keys across all series (numeric-sorted or first-seen order).
const xKeys = computed(() => {
  const seen = new Map()
  for (const s of clean.value) for (const p of s.points) {
    const k = props.xIsNumeric ? Number(p.x) : String(p.x)
    if (!seen.has(String(k))) seen.set(String(k), k)
  }
  const arr = [...seen.values()]
  if (props.xIsNumeric) arr.sort((a, b) => a - b)
  return arr
})

const xPos = (key) => {
  const keys = xKeys.value
  if (props.xIsNumeric) {
    const lo = keys[0]; const hi = keys[keys.length - 1]
    const span = hi - lo || 1
    return M.left + ((Number(key) - lo) / span) * IW
  }
  const idx = keys.findIndex((k) => String(k) === String(key))
  const n = keys.length
  const step = n > 1 ? IW / (n - 1) : 0
  return M.left + (n > 1 ? idx * step : IW / 2)
}

const yMax = computed(() => {
  let m = 0
  for (const s of clean.value) for (const p of s.points) if (Number.isFinite(+p.y)) m = Math.max(m, +p.y)
  return m > 0 ? m * 1.08 : 1
})
const yMin = computed(() => {
  let m = 0
  for (const s of clean.value) for (const p of s.points) if (Number.isFinite(+p.y)) m = Math.min(m, +p.y)
  return m < 0 ? m * 1.08 : 0
})
const yPos = (v) => {
  const lo = yMin.value; const hi = yMax.value; const span = hi - lo || 1
  return M.top + IH - ((v - lo) / span) * IH
}

const paths = computed(() => clean.value.map((s) => {
  const byKey = new Map(s.points.map((p) => [props.xIsNumeric ? String(Number(p.x)) : String(p.x), +p.y]))
  const d = xKeys.value
    .filter((k) => byKey.has(String(k)) && Number.isFinite(byKey.get(String(k))))
    .map((k, i) => `${i === 0 ? 'M' : 'L'} ${xPos(k).toFixed(1)} ${yPos(byKey.get(String(k))).toFixed(1)}`)
    .join(' ')
  const last = [...byKey.keys()].findLast((k) => Number.isFinite(byKey.get(k)))
  return { ...s, d, endX: last == null ? 0 : xPos(last), endY: last == null ? 0 : yPos(byKey.get(last)) }
}))

const yTicks = computed(() => {
  const lo = yMin.value; const hi = yMax.value; const n = 5
  return Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n)
})
const xTicks = computed(() => {
  const keys = xKeys.value
  if (keys.length <= 8) return keys
  const step = Math.ceil(keys.length / 8)
  return keys.filter((_, i) => i % step === 0)
})

const showEndLabels = computed(() => clean.value.length <= 4)
const compact = (v) => {
  const a = Math.abs(v)
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return `${Math.round(v * 100) / 100}`
}

// ── hover crosshair + tooltip ───────────────────────────────────
const hover = ref(null)
const svgRef = ref(null)
function onMove(e) {
  const svg = svgRef.value
  if (!svg || !xKeys.value.length) return
  const rect = svg.getBoundingClientRect()
  const px = ((e.clientX - rect.left) / rect.width) * W
  let best = null; let bestD = Infinity
  for (const k of xKeys.value) {
    const d = Math.abs(xPos(k) - px)
    if (d < bestD) { bestD = d; best = k }
  }
  if (best != null) hover.value = { key: best, px: xPos(best) }
}
const hoverRows = computed(() => {
  if (!hover.value) return []
  const k = String(hover.value.key)
  return clean.value.map((s) => {
    const p = s.points.find((pt) => (props.xIsNumeric ? String(Number(pt.x)) : String(pt.x)) === k)
    return p && Number.isFinite(+p.y) ? { name: s.name, color: s.color, value: +p.y } : null
  }).filter(Boolean)
})
const tooltipLeftPct = computed(() => (hover.value ? (hover.value.px / W) * 100 : 0))
</script>

<template>
  <div class="mlc" data-testid="multi-line-chart">
    <div v-if="clean.length >= 2" class="mlc-legend" data-testid="mlc-legend">
      <span v-for="s in clean" :key="s.name" class="mlc-leg">
        <i class="mlc-dot" :style="{ background: s.color }" /> {{ s.name }}
      </span>
    </div>
    <div v-if="!clean.length" class="mlc-empty">No series to plot.</div>
    <div v-else class="mlc-wrap">
      <svg
ref="svgRef" :viewBox="`0 0 ${W} ${H}`" class="mlc-svg" preserveAspectRatio="xMidYMid meet"
           @mousemove="onMove" @mouseleave="hover = null">
        <g class="mlc-grid">
          <template v-for="t in yTicks" :key="'y' + t">
            <line :x1="M.left" :x2="W - M.right" :y1="yPos(t)" :y2="yPos(t)" />
            <text :x="M.left - 8" :y="yPos(t)" text-anchor="end" dominant-baseline="middle" class="mlc-tick">{{ compact(t) }}</text>
          </template>
        </g>
        <g class="mlc-xaxis">
          <text v-for="k in xTicks" :key="'x' + k" :x="xPos(k)" :y="H - M.bottom + 18" text-anchor="middle" class="mlc-tick">
            {{ xIsNumeric ? compact(Number(k)) : String(k).slice(0, 10) }}
          </text>
        </g>
        <line v-if="hover" :x1="hover.px" :x2="hover.px" :y1="M.top" :y2="H - M.bottom" class="mlc-crosshair" />
        <path v-for="s in paths" :key="s.name" :d="s.d" :stroke="s.color" class="mlc-line" />
        <template v-if="hover">
          <circle v-for="r in hoverRows" :key="'h' + r.name" :cx="hover.px" :cy="yPos(r.value)" r="3.5" :fill="r.color" class="mlc-pt" />
        </template>
        <template v-if="showEndLabels">
          <text v-for="s in paths" :key="'lbl' + s.name" :x="Math.min(s.endX + 6, W - 2)" :y="s.endY" dominant-baseline="middle" :fill="s.color" class="mlc-endlbl">{{ s.name }}</text>
        </template>
        <text :x="M.left + IW / 2" :y="H - 4" text-anchor="middle" class="mlc-axislabel">{{ xLabel }}</text>
        <text :x="14" :y="M.top + IH / 2" text-anchor="middle" class="mlc-axislabel" :transform="`rotate(-90 14 ${M.top + IH / 2})`">{{ yLabel }}</text>
      </svg>
      <div v-if="hover && hoverRows.length" class="mlc-tooltip" :style="{ left: tooltipLeftPct + '%' }" data-testid="mlc-tooltip">
        <div class="mlc-tt-x">{{ xLabel || 'x' }}: {{ xIsNumeric ? Number(hover.key) : hover.key }}</div>
        <div v-for="r in hoverRows" :key="'tt' + r.name" class="mlc-tt-row">
          <i class="mlc-dot" :style="{ background: r.color }" /><span class="mlc-tt-name">{{ r.name }}</span>
          <span class="mlc-tt-val">{{ formatValue(r.value) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mlc { position: relative; width: 100%; }
.mlc-legend { display: flex; flex-wrap: wrap; gap: 0.4rem 0.9rem; margin-bottom: 0.4rem; font-size: 0.78rem; color: var(--text); }
.mlc-leg { display: inline-flex; align-items: center; gap: 0.3rem; }
.mlc-dot { width: 0.7rem; height: 0.7rem; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.mlc-empty { color: var(--muted); font-size: 0.85rem; padding: 1rem; }
.mlc-wrap { position: relative; }
.mlc-svg { width: 100%; height: auto; display: block; }
.mlc-grid line { stroke: var(--border); stroke-width: 0.5; }
.mlc-tick { fill: var(--muted); font-size: 10px; }
.mlc-axislabel { fill: var(--muted); font-size: 11px; font-weight: 600; }
.mlc-line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.mlc-crosshair { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.7; }
.mlc-pt { stroke: var(--surface); stroke-width: 1.5; }
.mlc-endlbl { font-size: 10px; font-weight: 600; }
.mlc-tooltip { position: absolute; top: 0; transform: translateX(-50%); background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.4rem 0.55rem; font-size: 0.75rem; pointer-events: none; box-shadow: 0 4px 14px rgba(0,0,0,0.12); min-width: 8rem; z-index: 5; }
.mlc-tt-x { color: var(--muted); font-weight: 600; margin-bottom: 0.2rem; }
.mlc-tt-row { display: flex; align-items: center; gap: 0.35rem; }
.mlc-tt-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mlc-tt-val { font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
