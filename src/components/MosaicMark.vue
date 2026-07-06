<script setup>
/**
 * The Fontem mark — the Mosaic of Europe. Tesserae of the platform's
 * eight categorical chart hues tile the silhouette of the continent
 * (the grid below is rasterised from Fontem's own NUTS-0 boundaries).
 * Onyx and umber "drawing stones" are woven through — in the mosaic
 * craft the dark stones draw the figure, so it doesn't hold together
 * without them, and neither does Europe. A single gold tessera near
 * the centre is the source: fontem, the spring. On dark grounds the
 * drawing stones take a thin gold-glass rim (the Byzantine trick) so
 * they stay legible against dusk.
 *
 * Decorative by default (aria-hidden); the surrounding button/link
 * carries the accessible name.
 */
import { computed } from 'vue'

defineProps({
  /** Rendered pixel size. */
  size: { type: [Number, String], default: 28 },
})

// Europe as a low-res mask — one string per row, '#' = land. Rasterised
// from the NUTS-0 country outlines the platform already serves.
const GRID = [
  '.........###', '........####', '.......###.#', '.....####.##',
  '.....####..#', '.#.....##.##', '#.#...#.###.', '..#.#######.',
  '...#######..', '...#########', '...####.####', '####...#.###',
  '###.....#.##', '.##.......#.',
]
const COLS = 12
const GOLD_C = 7
const GOLD_R = 7
const HUES = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834']
const ONYX = '#2e1d10'
const UMBER = '#7a4a28'
const GOLD = '#c9a227'

// Fit the grid into the 64-unit viewBox with a small margin.
const AVAIL = 58
const CELL = AVAIL / Math.max(COLS, GRID.length)
const OX = (64 - COLS * CELL) / 2
const OY = (64 - GRID.length * CELL) / 2

const tesserae = computed(() => {
  const out = []
  let hue = 0
  let idx = 0
  GRID.forEach((row, r) => {
    for (let c = 0; c < COLS; c += 1) {
      if (row[c] === '#') {
        const s = CELL * 0.84
        let fill
        let kind = ''
        if (c === GOLD_C && r === GOLD_R) {
          fill = GOLD; kind = 'src'
        } else if (idx % 5 === 2) {
          fill = idx % 10 === 2 ? ONYX : UMBER; kind = 'draw'
        } else {
          fill = HUES[hue % HUES.length]; hue += 3
        }
        idx += 1
        out.push({
          x: +(OX + c * CELL).toFixed(2),
          y: +(OY + r * CELL).toFixed(2),
          s: +s.toFixed(2),
          rx: +Math.max(0.4, s * 0.22).toFixed(2),
          fill,
          kind,
        })
      }
    }
  })
  return out
})
</script>

<template>
  <svg
    class="mosaic-mark" :width="size" :height="size" viewBox="0 0 64 64"
    aria-hidden="true" focusable="false"
  >
    <rect
      v-for="(t, i) in tesserae" :key="i"
      :class="{ 'mm-draw': t.kind === 'draw', 'mm-src': t.kind === 'src' }"
      :x="t.x" :y="t.y" :width="t.s" :height="t.s" :rx="t.rx" :fill="t.fill"
    />
  </svg>
</template>

<style scoped>
.mosaic-mark { display: block; }
/* Drawing stones read on light grounds; on the dusk chrome of dark mode
   they take the Byzantine gold-glass rim so the figure stays legible. */
.mosaic-mark .mm-draw { stroke: none; }
:global(html.dark) .mosaic-mark .mm-draw { stroke: #c9a227; stroke-width: 0.5; }
@media (prefers-color-scheme: dark) {
  .mosaic-mark .mm-draw { stroke: #c9a227; stroke-width: 0.5; }
}
:global(html:not(.dark)) .mosaic-mark .mm-draw { stroke: none; }
</style>
