<script setup>
/**
 * The Fontem mark — the Spun Thread. A single thread unspools from a
 * gold source-point (fontem, the spring) and spirals outward, beaded
 * with tesserae of the platform's eight categorical chart hues: each
 * bead is a record strung on the line you follow — following the money.
 * Onyx and umber "drawing stones" are woven through (the dark stones
 * draw the figure). The spiral is the spindle-whorl and the spun thread
 * of the Fates — following a thread, and spinning it, are the oldest
 * women's knowledge in Europe. On dark grounds the thread lifts and the
 * drawing stones take a gold-glass rim (the Byzantine trick).
 *
 * The geometry is computed (one source of truth, matching the favicon),
 * decorative by default (aria-hidden); the surrounding button/link
 * carries the accessible name.
 */
import { computed } from 'vue'

defineProps({
  /** Rendered pixel size. */
  size: { type: [Number, String], default: 28 },
})

const HUES = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834']
const ONYX = '#2e1d10'
const UMBER = '#7a4a28'

// Archimedean spiral r = rIn + b·θ, sampled finely for the thread stroke;
// tesserae are dropped along it at roughly equal arc length.
const CX = 32
const TURNS = 2.55
const THETA_MAX = TURNS * 2 * Math.PI
const R_IN = 3.6
const R_OUT = 25.5
const B = (R_OUT - R_IN) / THETA_MAX
const SPACING = 6

const mark = computed(() => {
  const pts = []
  for (let th = 0; th <= THETA_MAX; th += 0.05) {
    const r = R_IN + B * th
    pts.push([CX + r * Math.cos(th), CX + r * Math.sin(th), th])
  }
  const threadD = pts.reduce(
    (d, p, i) => d + `${i ? ' L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`, '')

  const beads = []
  let acc = SPACING
  let hue = 0
  let k = 0
  let prev = null
  pts.forEach((p) => {
    if (prev) acc += Math.hypot(p[0] - prev[0], p[1] - prev[1])
    prev = p
    if (acc >= SPACING && p[2] > 0.35) {
      acc = 0
      const s = 3.2 + (p[2] / THETA_MAX) * 2.4
      const draw = k % 5 === 2
      let fill
      if (draw) {
        fill = k % 10 === 2 ? ONYX : UMBER
      } else {
        fill = HUES[hue % HUES.length]
        hue += 3
      }
      k += 1
      beads.push({
        x: +(p[0] - s / 2).toFixed(2),
        y: +(p[1] - s / 2).toFixed(2),
        s: +s.toFixed(2),
        rx: +(s * 0.24).toFixed(2),
        rot: `rotate(${((p[2] * 180) / Math.PI + 45).toFixed(1)} ${p[0].toFixed(2)} ${p[1].toFixed(2)})`,
        fill,
        draw,
      })
    }
  })
  return { threadD, beads }
})
</script>

<template>
  <svg
    class="mosaic-mark" :width="size" :height="size" viewBox="0 0 64 64"
    aria-hidden="true" focusable="false"
  >
    <path
      class="mm-thread" :d="mark.threadD" fill="none"
      stroke-width="1.5" stroke-linecap="round" opacity="0.55"
    />
    <rect
      v-for="(t, i) in mark.beads" :key="i"
      :class="{ 'mm-draw': t.draw }"
      :x="t.x" :y="t.y" :width="t.s" :height="t.s" :rx="t.rx"
      :fill="t.fill" :transform="t.rot"
    />
    <circle cx="32" cy="32" r="4.6" fill="#c9a227" />
    <circle class="mm-ring" cx="32" cy="32" r="4.6" fill="none" stroke-width="1.1" />
  </svg>
</template>

<style scoped>
.mosaic-mark { display: block; }
/* The thread + source ring are lapis; on dusk they lift so the mark
   reads on dark chrome. The drawing stones take the Byzantine
   gold-glass rim in dark, same as the favicon. */
.mm-thread, .mm-ring { stroke: #1d4e9e; }
.mosaic-mark .mm-draw { stroke: none; }
:global(html.dark) .mm-thread,
:global(html.dark) .mm-ring { stroke: #8fb0ea; }
:global(html.dark) .mosaic-mark .mm-draw { stroke: #c9a227; stroke-width: 0.6; }
@media (prefers-color-scheme: dark) {
  .mm-thread, .mm-ring { stroke: #8fb0ea; }
  .mosaic-mark .mm-draw { stroke: #c9a227; stroke-width: 0.6; }
}
:global(html:not(.dark)) .mm-thread,
:global(html:not(.dark)) .mm-ring { stroke: #1d4e9e; }
:global(html:not(.dark)) .mosaic-mark .mm-draw { stroke: none; }
</style>
