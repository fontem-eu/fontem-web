<script setup>
/**
 * Loading overlay for choropleth maps.
 *
 * Sits absolute over its host (which must be `position: relative`)
 * and:
 *  1. Shows a spinner + "Loading…" label so users know data is being
 *     fetched (vs the previous silent state where a blank map could
 *     mean "no data available" OR "still loading").
 *  2. Blocks pointer events while loading so the user can't pan/zoom
 *     into a stale layer and think the new layer broke when it finally
 *     paints.
 *  3. Optional error mode — same backdrop, red text. Re-uses the
 *     blocking behaviour because an errored map is also non-
 *     interactive until the error clears.
 *
 * Used by AtlasView, AtlasMapEmbed, and EntityNutsMap. Extracted into
 * widgets/atlas/ alongside colorScale + AtlasLegend so all the
 * map-rendering bits live together.
 */
import { computed } from 'vue'

const props = defineProps({
  loading: { type: Boolean, default: false },
  // Optional explicit message override. Defaults are fine for most
  // callers; pass a custom one when the host wants to be specific
  // (e.g. "Loading boundaries…" vs "Fetching observations…").
  message: { type: String, default: 'Loading data…' },
  // When set, renders an error pill instead of the spinner.
  // Mutually exclusive with `loading` — if both are set, error
  // wins (the map is not actively fetching anymore).
  error:   { type: String, default: '' },
})

const visible = computed(() => Boolean(props.error) || props.loading)
const inErrorState = computed(() => Boolean(props.error))
</script>

<template>
  <div
    v-if="visible"
    class="map-loading-overlay"
    :class="{ 'in-error': inErrorState }"
    role="status"
    :aria-busy="loading && !inErrorState"
    :aria-live="inErrorState ? 'assertive' : 'polite'"
    data-testid="map-loading-overlay"
  >
    <div class="map-loading-card">
      <div v-if="!inErrorState" class="map-loading-spinner" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p class="map-loading-text" :class="{ err: inErrorState }">
        {{ inErrorState ? error : message }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.map-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--bg) 65%, transparent);
  /* Pointer-events stay enabled on the overlay itself — that's
     what blocks the underlying map from receiving pan/zoom while
     we're loading. */
  cursor: progress;
  backdrop-filter: blur(2px);
}
.map-loading-overlay.in-error { cursor: not-allowed; }

.map-loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.85rem 1.2rem;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16);
  font-size: 0.85rem;
  color: var(--text);
}

/* Three-dot pulse — light enough that a re-fetch on a slider drag
   doesn't feel like a heavy spinner stealing focus. Each dot
   bounces 0.16s out of phase with the next so the eye reads it as
   a wave, not three blinking lights. */
.map-loading-spinner {
  display: inline-flex;
  gap: 0.35rem;
}
.map-loading-spinner span {
  width: 0.45rem;
  height: 0.45rem;
  background: var(--accent);
  border-radius: 50%;
  display: inline-block;
  animation: map-loading-bounce 0.9s infinite ease-in-out;
}
.map-loading-spinner span:nth-child(2) { animation-delay: 0.16s; }
.map-loading-spinner span:nth-child(3) { animation-delay: 0.32s; }

@keyframes map-loading-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.7; }
  40%           { transform: translateY(-4px); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  /* Honour user preference — keep a static dot trio rather than
     a fully-empty card (still signals 'something is happening'). */
  .map-loading-spinner span { animation: none; opacity: 0.85; }
}

.map-loading-text { margin: 0; }
.map-loading-text.err { color: #b91c1c; font-weight: 500; }
</style>
