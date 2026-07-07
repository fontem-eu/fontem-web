<script setup>
/**
 * Correlation matrix (SVG heatmap). Pairwise Pearson r between numeric columns,
 * on a diverging blue↔grey↔red scale centred at r = 0 (blue = negative, red =
 * positive, grey = no linear relationship). Cells carry a plain-language
 * strength label (none / mild / moderate / strong — thresholds in
 * vizPalette.corrStrength) so non-statisticians can read the picture at a
 * glance; the numeric r appears in the readout on hover, or on tap on touch
 * devices. The diagonal is the variable against itself and stays unlabelled.
 *
 * Props: vars: [name], matrix: [[r|null]] (square)
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { divergingColor, inkFor, corrStrength } from '../../utils/vizPalette.js'

const props = defineProps({
  vars: { type: Array, default: () => [] },
  matrix: { type: Array, default: () => [] },
})

const { t } = useI18n()

const CELL = 46
const LABEL = 96
const PAD = 8
const k = computed(() => props.vars.length)
const W = computed(() => LABEL + k.value * CELL + PAD)
const H = computed(() => LABEL + k.value * CELL + PAD + 40)

const cellColor = (r) => (r == null ? 'var(--surface)' : divergingColor(r, -1, 1, 0))
// Ink derives from the cell fill (theme-independent), never from var(--text):
// the dark theme's near-white text vanishes on the light diverging midpoint.
const textColor = (r) => (r == null ? 'var(--text)' : inkFor(cellColor(r)))
const fmtR = (r) => {
  if (r == null) return '—'
  const sign = r < 0 ? '−' : ''
  return sign + Math.abs(r).toFixed(2)
}

// Cell label: plain-language strength; blank on the diagonal (self ×  self).
const cellLabel = (r, i, j) => {
  if (i === j || r == null) return ''
  const s = corrStrength(r)
  return s ? t(`corr_matrix.${s}`) : ''
}
// Squeeze long translations into the cell rather than overflowing it.
const fitLength = (label) => (label.length * 6 > CELL - 6 ? CELL - 6 : undefined)

// Readout: full sentence with the number. Hover on desktop; tap on touch
// devices (click fires for both, so one handler covers mobile).
const hover = ref(null)
const pick = (i, j, r) => { hover.value = { i, j, r } }
const readout = computed(() => {
  if (!hover.value) return null
  const { i, j, r } = hover.value
  if (i === j) return { pair: props.vars[i], text: t('corr_matrix.self'), r: null }
  const s = corrStrength(r)
  let text = s ? t(`corr_matrix.${s}`) : '—'
  if (s && s !== 'none' && r < 0) text += ` (${t('corr_matrix.inverse')})`
  return { pair: `${props.vars[i]} × ${props.vars[j]}`, text, r }
})

const legendStops = [-1, -0.5, 0, 0.5, 1]
const thresholdHint = computed(() =>
  `|r| < 0.2 ${t('corr_matrix.none')} · 0.2–0.4 ${t('corr_matrix.mild')} · `
  + `0.4–0.7 ${t('corr_matrix.moderate')} · ≥ 0.7 ${t('corr_matrix.strong')}`)
</script>

<template>
  <div class="cm" data-testid="corr-matrix">
    <div v-if="k < 2" class="cm-empty">{{ $t('corr_matrix.pick_at_least_two_numeric_columns') }}</div>
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
           @mouseenter="pick(i, j, r)" @mouseleave="hover = null"
           @click="pick(i, j, r)">
          <rect
:x="LABEL + j * CELL" :y="LABEL + i * CELL" :width="CELL - 2" :height="CELL - 2" rx="3"
                :fill="cellColor(r)" class="cm-cell"
                :class="{ 'cm-cell--hi': hover && hover.i === i && hover.j === j }" />
          <text
:x="LABEL + j * CELL + (CELL - 2) / 2" :y="LABEL + i * CELL + (CELL - 2) / 2"
                text-anchor="middle" dominant-baseline="middle" class="cm-val" :fill="textColor(r)"
                :textLength="fitLength(cellLabel(r, i, j))"
                lengthAdjust="spacingAndGlyphs">{{ cellLabel(r, i, j) }}</text>
        </g>
      </g>
      <!-- diverging legend + plain-language thresholds -->
      <g :transform="`translate(${LABEL}, ${LABEL + k * CELL + 14})`">
        <rect v-for="(s, idx) in legendStops" :key="'lg' + idx" :x="idx * 26" y="0" width="24" height="10" rx="2" :fill="divergingColor(s, -1, 1, 0)" />
        <text x="0" y="22" class="cm-legtxt" text-anchor="start">−1</text>
        <text :x="2 * 26 + 12" y="22" class="cm-legtxt" text-anchor="middle">0</text>
        <text :x="4 * 26 + 24" y="22" class="cm-legtxt" text-anchor="end">+1</text>
        <text :x="5 * 26 + 12" y="9" class="cm-legtxt" text-anchor="start">{{ $t('corr_matrix.pearson_r') }}</text>
        <text x="0" y="36" class="cm-legtxt" data-testid="cm-thresholds">{{ thresholdHint }}</text>
      </g>
    </svg>
    <div v-if="readout" class="cm-readout" data-testid="cm-readout">
      <strong>{{ readout.pair }}</strong>: {{ readout.text }}
      <span v-if="readout.r != null" class="cm-readout-r">r = {{ fmtR(readout.r) }}</span>
    </div>
    <div v-else-if="k >= 2" class="cm-readout cm-readout--hint" data-testid="cm-hint">
      {{ t('corr_matrix.hint') }}
    </div>
  </div>
</template>

<style scoped>
.cm { width: 100%; }
.cm-empty { color: var(--muted); font-size: 0.85rem; padding: 1rem; }
.cm-svg { width: 100%; max-width: 640px; height: auto; display: block; }
.cm-head { fill: var(--text); font-size: 11px; font-weight: 600; }
.cm-cell { stroke: var(--surface); stroke-width: 1; cursor: pointer; }
.cm-cell--hi { stroke: var(--text); stroke-width: 2; }
.cm-val { font-size: 10px; font-weight: 600; pointer-events: none; }
.cm-legtxt { fill: var(--muted); font-size: 10px; }
.cm-readout { margin-top: 0.4rem; font-size: 0.82rem; color: var(--text); }
.cm-readout-r { margin-left: 0.5rem; font-variant-numeric: tabular-nums; font-weight: 600; }
.cm-readout--hint { color: var(--muted); font-size: 0.75rem; }
</style>
