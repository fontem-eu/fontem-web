<script setup>
/**
 * The Dargle wordmark — two-tone, theme-aware.
 *
 * The split is not decorative and not a syllable break: the three
 * groups spell the motto's initials.
 *
 *     D        ARG        LE
 *     Discover  ARGue     Learn · Enjoy
 *
 * So `ARG` carries the second colour — argument is the middle of the
 * name and the middle of the idea — while `D` and `LE` share the first.
 * Read the coloured groups and you have read the motto.
 *
 * Two consequences worth stating, because both are easy to undo by
 * accident:
 *
 *   * The letters are literal, never translated. The wordmark that came
 *     before this one put its first segment through i18n, because
 *     "Font" is a common noun — and 23 locales duly rendered the brand
 *     as Шрифт, Písmo, Schriftart. A proper noun has no translation.
 *   * The motto stays English everywhere for the same reason the split
 *     exists. "Entdecken. Streiten. Lernen. Genießen." is a fine German
 *     sentence and spells E-S-L-G, which is not the name on the door.
 *
 * Colours come from theme tokens (--brand-primary / --brand-secondary),
 * so the mark adapts to light and dark without per-theme markup.
 *
 * The wrapper carries the accessible name and the three spans are
 * aria-hidden, or a screen reader reads out "D, ARG, LE".
 */
defineProps({
  /** Rendered size. 'sm' = header; 'lg' = landing-card hero. */
  size: { type: String, default: 'sm' },
})
</script>

<template>
  <span class="wordmark" :class="`wordmark--${size}`" :aria-label="$t('wordmark.name')">
    <span class="wordmark-a" aria-hidden="true">D</span><span
      class="wordmark-b"
      aria-hidden="true"
    >ARG</span><span class="wordmark-a" aria-hidden="true">LE</span>
  </span>
</template>

<style scoped>
.wordmark {
  font-weight: 800;
  letter-spacing: -0.015em;
  line-height: 1;
  white-space: nowrap;
  user-select: none;
}
.wordmark-a { color: var(--brand-primary); }
.wordmark-b { color: var(--brand-secondary); }

.wordmark--sm {
  font-size: 1.25rem;
}
.wordmark--lg {
  font-size: 2.5rem;
  letter-spacing: -0.02em;
}
@media (min-width: 640px) {
  .wordmark--lg { font-size: 3rem; }
}
</style>
