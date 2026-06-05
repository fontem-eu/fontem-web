<script setup>
/**
 * The Fontem wordmark — two-tone, theme-aware.
 *
 * Split on the Latin syllable break (Fon-tem) so the colour change
 * lands on a natural pause, not mid-glyph.  Colours come from theme
 * tokens (--brand-primary / --brand-secondary), so the mark adapts to
 * light / dark / autumn without per-theme markup.
 */
defineProps({
  /** Rendered size. 'sm' = header; 'lg' = landing-card hero. */
  size: { type: String, default: 'sm' },
})
</script>

<template>
  <span class="wordmark" :class="`wordmark--${size}`" :aria-label="$t('wordmark.fontem')">
    <span class="wordmark-a" aria-hidden="true">{{ $t('wordmark.fon') }}</span><span
      class="wordmark-b"
      aria-hidden="true"
    >tem</span>
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
