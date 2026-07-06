<script setup>
/**
 * The Fontem mark — the Mosaic Spring. Tesserae of the platform's eight
 * categorical chart hues radiate in rings from a gold source-point
 * (fontem = the spring); onyx and umber "drawing stones" are woven
 * through the ring — in the mosaic craft the dark stones draw the
 * figure, so the mark doesn't hold together without them. On dark
 * grounds the drawing stones take a thin gold-glass rim (the Byzantine
 * trick) to stay legible against dusk.
 *
 * The tesserae are computed (not hand-authored) so the geometry stays
 * one source of truth — the same construction the favicon uses.
 * Decorative by default (aria-hidden); the surrounding button/link
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
// [radius, count, tessera-size, angular offset] per ring, outward.
const RINGS = [[11.5, 7, 6.4, 0], [21.5, 12, 7.2, 0.26], [30.2, 17, 6, 0.12]]

// Each fifth stone "draws" (onyx / umber alternating); the rest cycle
// the categorical hues with a stride that keeps neighbours distinct.
const tesserae = computed(() => {
  const out = []
  let hue = 0
  let idx = 0
  RINGS.forEach(([r, n, ts, off], ri) => {
    for (let i = 0; i < n; i += 1) {
      const a = off + (i * 2 * Math.PI) / n
      const x = 32 + r * Math.cos(a)
      const y = 32 + r * Math.sin(a)
      const draws = idx % 5 === 2
      let fill
      if (draws) {
        fill = idx % 10 === 2 ? ONYX : UMBER
      } else {
        fill = HUES[hue % HUES.length]
        hue += ri === 1 ? 3 : 5
      }
      idx += 1
      out.push({
        x: +(x - ts / 2).toFixed(2),
        y: +(y - ts / 2).toFixed(2),
        s: ts,
        fill,
        draws,
        rot: `rotate(${((a * 180) / Math.PI + 90).toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})`,
      })
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
      :class="{ 'mm-draw': t.draws }"
      :x="t.x" :y="t.y" :width="t.s" :height="t.s" rx="1.6"
      :fill="t.fill" :transform="t.rot"
    />
    <circle cx="32" cy="32" r="3.6" fill="#c9a227" />
  </svg>
</template>

<style scoped>
.mosaic-mark { display: block; }
/* The drawing stones read fine on light grounds. On the dusk chrome of
   dark mode they'd sink in, so they take the Byzantine gold-glass rim —
   the same move as the favicon. */
.mosaic-mark .mm-draw { stroke: none; }
:global(html.dark) .mosaic-mark .mm-draw { stroke: #c9a227; stroke-width: 0.9; }
@media (prefers-color-scheme: dark) {
  .mosaic-mark .mm-draw { stroke: #c9a227; stroke-width: 0.9; }
}
:global(html:not(.dark)) .mosaic-mark .mm-draw { stroke: none; }
</style>
