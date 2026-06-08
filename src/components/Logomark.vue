<script setup>
/**
 * Fontem logomark — the lavender sprig used in the page header.
 *
 * Inline SVG so the stem + bud colours flow through theme tokens
 * (--muted for stem, --brand-secondary for buds) without a separate
 * asset request and without `prefers-color-scheme` baked in. Sits
 * where the textual wordmark used to in the top-left; the wordmark
 * still appears in landing-hero spots (AboutView, PublicSpendingView)
 * where the brand text reinforces the name.
 */
defineProps({
  /** Rendered height. 'sm' = header; 'md' = larger inline use. */
  size: { type: String, default: 'sm' },
})
</script>

<template>
  <span class="logomark" :class="`logomark--${size}`">
    <svg
      viewBox="0 0 56 88"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      :aria-label="$t('wordmark.fontem')"
    >
      <!-- Stem + two curved leaves, drawn with a muted-taupe stroke
           so they recede vs. the bud cluster. -->
      <g class="stem" stroke-linecap="round" fill="none" stroke-width="2.4">
        <line x1="28" y1="40" x2="28" y2="82"/>
        <path d="M28 60 q-7 -2 -10.5 -7"/>
        <path d="M28 66 q7 -2 10.5 -7"/>
      </g>

      <!-- Bud cluster — alternating bud + bud-hi shades give the
           sprig dimension even at small sizes. -->
      <g>
        <circle class="bud"    cx="28"   cy="6"   r="2.6"/>
        <circle class="bud-hi" cx="23"   cy="10"  r="2.8"/>
        <circle class="bud"    cx="33"   cy="10"  r="2.8"/>
        <circle class="bud-hi" cx="28"   cy="14"  r="3.0"/>
        <circle class="bud"    cx="23"   cy="18.5" r="3.0"/>
        <circle class="bud-hi" cx="33"   cy="18.5" r="3.0"/>
        <circle class="bud"    cx="28"   cy="23"  r="2.8"/>
        <circle class="bud-hi" cx="24.5" cy="27"  r="2.6"/>
        <circle class="bud"    cx="31.5" cy="27"  r="2.6"/>
        <circle class="bud-hi" cx="28"   cy="31"  r="2.4"/>
        <circle class="bud"    cx="26.5" cy="35"  r="2.0"/>
        <circle class="bud-hi" cx="29.5" cy="35"  r="2.0"/>
      </g>
    </svg>
  </span>
</template>

<style scoped>
.logomark {
  display: inline-block;
  line-height: 0;
}
.logomark svg {
  display: block;
  height: 100%;
  width: auto;
}

/* Theme tokens carry the colour. brand-secondary is the dusty
   aster lavender; bud-hi is a softened lift driven by a colour-mix
   so we don't have to maintain a separate token. */
.logomark .stem    { stroke: var(--muted); opacity: 0.85; }
.logomark .bud     { fill: var(--brand-secondary); }
.logomark .bud-hi  { fill: color-mix(in oklab, var(--brand-secondary) 70%, white); }

:global(html.dark) .logomark .bud-hi {
  fill: color-mix(in oklab, var(--brand-secondary) 70%, #ffffff);
}

.logomark--sm { height: 2.25rem; }
.logomark--md { height: 3rem; }
.logomark--lg { height: 4.5rem; }
</style>
