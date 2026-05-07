<script setup>
/**
 * Atlas legend — gradient bar with min/max ticks + null swatch.
 *
 * Reads the same `colorScale.js` helpers as the map so the two can
 * never disagree on breakpoints. Renders compact and absolute-
 * positioned by default, but the host (AtlasView) wraps it in
 * whatever layout it likes.
 */
import { computed } from 'vue'
import { legendStops, NULL_COLOR } from './colorScale.js'

const props = defineProps({
  bounds:    { type: Array,  default: null },        // [lo, hi]
  kind:      { type: String, default: 'sequential' }, // sequential | diverging
  log:       { type: Boolean, default: false },
  // Palette ID from the colour-scale catalog. 'auto' picks viridis
  // for sequential / PuOr for diverging — the CVD-safe defaults.
  palette:   { type: String, default: 'auto' },
  // Optional unit hint for the tick labels (e.g. "EUR", "%", "/100k").
  unit:      { type: String, default: '' },
  // Render label hidden when caller decides the legend itself is the
  // label (mobile, compact toolbars).
  title:     { type: String, default: '' },
  // Show "no data" swatch — almost always wanted; off only for
  // overlays that prove their own data presence.
  showNull:  { type: Boolean, default: true },
})

const stops = computed(() => legendStops({
  bounds: props.bounds, kind: props.kind, log: props.log, palette: props.palette,
}))

// CSS linear-gradient ticks: each stop is positioned at (value-lo)/(hi-lo)
// (or its log equivalent). We pre-compute percentages so the gradient
// is identical to the map's bin colours in the eye, even though the
// map uses discrete `step` and the legend uses a continuous gradient
// that the human visual system rounds to bins anyway.
const gradientCss = computed(() => {
  if (!props.bounds || stops.value.length === 0) return 'transparent'
  const [lo, hi] = props.bounds
  const span = hi - lo
  if (span <= 0) return stops.value[0].color
  const fmt = (s) => {
    let pct
    if (props.log && lo > 0) {
      pct = (Math.log(Math.max(s.value, lo)) - Math.log(lo))
          / (Math.log(hi) - Math.log(lo))
    } else {
      pct = (s.value - lo) / span
    }
    return `${s.color} ${(Math.max(0, Math.min(1, pct)) * 100).toFixed(1)}%`
  }
  return `linear-gradient(to right, ${stops.value.map(fmt).join(', ')})`
})

function fmtTick(v) {
  if (v == null || !Number.isFinite(v)) return ''
  const abs = Math.abs(v)
  // Compact human-readable: 1.2M, 350k, 12.4 — keeps the legend short
  // even on Population (range 0–80M) and percentages alike.
  let formatted
  if (abs >= 1e9) formatted = `${(v / 1e9).toFixed(1)}B`
  else if (abs >= 1e6) formatted = `${(v / 1e6).toFixed(1)}M`
  else if (abs >= 1e3) formatted = `${(v / 1e3).toFixed(1)}k`
  else if (abs >= 10)  formatted = v.toFixed(0)
  else                 formatted = v.toFixed(2)
  return props.unit ? `${formatted} ${props.unit}` : formatted
}
</script>

<template>
  <div class="atlas-legend" data-testid="atlas-legend" role="group" :aria-label="title || 'Atlas legend'">
    <div v-if="title" class="legend-title">{{ title }}</div>
    <div class="legend-row">
      <div
        v-if="bounds"
        class="legend-bar"
        :style="{ background: gradientCss }"
        :aria-hidden="true"
        data-testid="atlas-legend-bar"
      />
      <div v-if="bounds" class="legend-ticks">
        <span class="tick lo">{{ fmtTick(bounds[0]) }}</span>
        <span v-if="log" class="tick log-pill" aria-label="logarithmic scale">log</span>
        <span class="tick hi">{{ fmtTick(bounds[1]) }}</span>
      </div>
      <span v-if="showNull" class="null-swatch" data-testid="atlas-legend-null">
        <span class="null-dot" :style="{ background: NULL_COLOR }" />
        no data
      </span>
    </div>
  </div>
</template>

<style scoped>
.atlas-legend {
  font-size: 0.75rem;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.45rem 0.6rem;
  display: inline-flex;
  flex-direction: column;
  gap: 0.3rem;
  max-width: 420px;
}
.legend-title {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 600;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.legend-bar {
  width: 220px;
  height: 0.7rem;
  border-radius: 3px;
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.legend-ticks {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  font-variant-numeric: tabular-nums;
}
.tick.lo, .tick.hi { color: var(--text); font-weight: 500; }
.tick.log-pill {
  font-size: 0.6rem;
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.null-swatch {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--muted);
  font-size: 0.7rem;
  padding-left: 0.4rem;
  border-left: 1px solid var(--border);
}
.null-dot {
  display: inline-block;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 2px;
  border: 1px solid var(--border);
}
</style>
