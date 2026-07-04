<script setup>
/**
 * Correlation matrix (SVG heatmap). Pairwise Pearson r between numeric columns,
 * on a diverging blue↔grey↔red scale centred at r = 0 (blue = negative, red =
 * positive, grey = no linear relationship). Each cell shows its r; the diagonal
 * is 1. Hover highlights a pair. Built for comparing e.g. two indicators (rape
 * vs migration) — a 2×2 is just the smallest case.
 *
 * Props: vars: [name], matrix: [[r|null]] (square), formatN?: (r)=>string
 */
import { ref, computed } from 'vue'
import { divergingColor, inkFor } from '../../utils/vizPalette.js'

const props = defineProps({
  vars: { type: Array, default: () => [] },
  matrix: { type: Array, default: () => [] },
})

const CELL = 46
const LABEL = 96
const PAD = 8
const k = computed(() => props.vars.length)
const W = computed(() => LABEL + k.value * CELL + PAD)
const H = computed(() => LABEL + k.value * CELL + PAD + 26)

const cellColor = (r) => (r == null ? 'var(--surface)' : divergingColor(r, -1, 1, 0))
// Ink derives from the cell fill (theme-independent), never from var(--text):
// the dark theme's near-white text vanishes on the light diverging midpoint.
const textColor = (r) => (r == null ? 'var(--text)' : inkFor(cellColor(r)))
const fmtR = (r) => {
  if (r == null) return '—'
  const sign = r < 0 ? '−' : ''
  return sign + Math.abs(r).toFixed(2)
}

const hover = ref(null)
const legendStops = [-1, -0.5, 0, 0.5, 1]
</script>

<template>
  <div class="cm" data-testid="corr-matrix">
    <div v-if="k < 2" class="cm-empty">Pick at least two numeric columns to correlate.</div>
    <svg v-else :viewBox="`0 0 ${W} ${H}`" class="cm-svg" preserveAspectRatio="xMidYMid meet">
      <!-- column headers (angled) -->
      <text
v-for="(v, j) in vars" :key="'ch' + j"
            :x="LABEL + j * CELL + CELL / 2" :y="LABEL - 6"
            :transform="`rotate(-35 ${LABEL + j * CELL + CELL / 2} ${LABEL - 6})`"
            text-anchor="start" class="cm-head">{{ v }}</text>
      <!-- row headers -->
      <text
v-for="(v, i) in vars" :key="'rh' + i"
            :x="LABEL - 8" :y="LABEL + i * CELL + CELL / 2"
            text-anchor="end" dominant-baseline="middle" class="cm-head">{{ v }}</text>
      <!-- cells -->
      <g v-for="(row, i) in matrix" :key="'r' + i">
        <g
v-for="(r, j) in row" :key="'c' + i + '_' + j"
           @mouseenter="hover = { i, j, r }" @mouseleave="hover = null">
          <rect
:x="LABEL + j * CELL" :y="LABEL + i * CELL" :width="CELL - 2" :height="CELL - 2" rx="3"
                :fill="cellColor(r)" class="cm-cell"
                :class="{ 'cm-cell--hi': hover && hover.i === i && hover.j === j }" />
          <text
:x="LABEL + j * CELL + (CELL - 2) / 2" :y="LABEL + i * CELL + (CELL - 2) / 2"
                text-anchor="middle" dominant-baseline="middle" class="cm-val" :fill="textColor(r)">{{ fmtR(r) }}</text>
        </g>
      </g>
      <!-- diverging legend -->
      <g :transform="`translate(${LABEL}, ${LABEL + k * CELL + 14})`">
        <rect v-for="(s, idx) in legendStops" :key="'lg' + idx" :x="idx * 26" y="0" width="24" height="10" rx="2" :fill="divergingColor(s, -1, 1, 0)" />
        <text x="0" y="22" class="cm-legtxt" text-anchor="start">−1</text>
        <text :x="2 * 26 + 12" y="22" class="cm-legtxt" text-anchor="middle">0</text>
        <text :x="4 * 26 + 24" y="22" class="cm-legtxt" text-anchor="end">+1</text>
        <text :x="5 * 26 + 12" y="9" class="cm-legtxt" text-anchor="start">Pearson r</text>
      </g>
    </svg>
    <div v-if="hover" class="cm-readout" data-testid="cm-readout">
      <strong>{{ vars[hover.i] }}</strong> × <strong>{{ vars[hover.j] }}</strong>:
      r = {{ fmtR(hover.r) }}
    </div>
  </div>
</template>

<style scoped>
.cm { width: 100%; }
.cm-empty { color: var(--muted); font-size: 0.85rem; padding: 1rem; }
.cm-svg { width: 100%; max-width: 640px; height: auto; display: block; }
.cm-head { fill: var(--text); font-size: 11px; font-weight: 600; }
.cm-cell { stroke: var(--surface); stroke-width: 1; }
.cm-cell--hi { stroke: var(--text); stroke-width: 2; }
.cm-val { font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }
.cm-legtxt { fill: var(--muted); font-size: 10px; }
.cm-readout { margin-top: 0.4rem; font-size: 0.82rem; color: var(--text); }
</style>
