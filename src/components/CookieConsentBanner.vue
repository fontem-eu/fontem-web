<script setup>
/**
 * Cookie consent banner — shown until the user makes a choice.
 *
 * Persists choice in localStorage as 'gmr-cookie-consent' = 'accepted' | 'declined'.
 * Until 'accepted' is set, useAnalytics() is a no-op (see composables/useAnalytics.js).
 *
 * While the banner is visible, the height it occupies at the viewport
 * bottom is exposed as the CSS custom property `--cookie-banner-h` on
 * `<html>`. Any fixed-positioned UI element that would otherwise be
 * hidden behind the banner (chiefly the AssistPanel's input row) reads
 * this var to pad itself above the banner. When the banner is hidden,
 * the var goes back to `0px` so layouts collapse cleanly.
 *
 * The height is *measured*, not hardcoded — the previous 6rem constant
 * was correct for desktop but too short for mobile, where the banner
 * goes column-layout and the actions wrap below the text. A
 * ResizeObserver on the banner element re-publishes the var whenever
 * the rendered size changes (viewport resize, text reflow, font scale,
 * etc), so the AssistPanel input always sits at exactly the right
 * height above the banner.
 */
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

const visible = ref(false)
const STORAGE_KEY = 'gmr-cookie-consent'
// Safe fallback while the banner mounts but before the first
// ResizeObserver callback fires — large enough that nothing is
// occluded even on the narrowest column-layout viewport. The real
// per-render value lands within one frame anyway.
const FALLBACK_HEIGHT = '10rem'

const bannerEl = useTemplateRef('bannerEl')
let _ro = null

function setVar(value) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--cookie-banner-h', value)
}

function startMeasuring() {
  // Safety net so the first paint isn't occluded — overwritten by the
  // first ResizeObserver callback the same frame.
  setVar(FALLBACK_HEIGHT)
  if (typeof ResizeObserver === 'undefined' || !bannerEl.value) return
  _ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const h = entry.contentRect?.height
        ?? entry.target?.getBoundingClientRect?.().height
      if (typeof h !== 'number') continue
      setVar(`${Math.ceil(h)}px`)
    }
  })
  _ro.observe(bannerEl.value)
}

function stopMeasuring() {
  if (_ro) { _ro.disconnect(); _ro = null }
  setVar('0px')
}

onMounted(() => {
  if (typeof localStorage === 'undefined') return
  const choice = localStorage.getItem(STORAGE_KEY)
  if (choice !== 'accepted' && choice !== 'declined') {
    visible.value = true
    // Wait one tick so the <dialog> is in the DOM before we observe it.
    queueMicrotask(startMeasuring)
  }
})

onBeforeUnmount(stopMeasuring)

function accept() {
  localStorage.setItem(STORAGE_KEY, 'accepted')
  visible.value = false
  stopMeasuring()
}

function decline() {
  localStorage.setItem(STORAGE_KEY, 'declined')
  visible.value = false
  stopMeasuring()
}
</script>

<template>
  <Teleport to="body">
    <dialog v-if="visible" ref="bannerEl" open class="ccb" aria-label="Cookie consent" data-testid="cookie-consent-banner">
      <div class="ccb-text">
        We use a self-hosted analytics cookie to understand which pages are useful.
        No tracking, no third parties.
        <router-link to="/privacy" class="ccb-link">Learn more</router-link>
      </div>
      <div class="ccb-actions">
        <button
          type="button"
          class="ccb-btn ccb-btn--decline"
          data-testid="cookie-consent-decline"
          @click="decline"
        >
          Decline
        </button>
        <button
          type="button"
          class="ccb-btn ccb-btn--accept"
          data-testid="cookie-consent-accept"
          @click="accept"
        >
          Accept
        </button>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
/* Native <dialog> ships UA defaults (margin, border, width:-moz-fit-content,
   block-level auto-sizing) — neutralise those so the banner still spans
   the full viewport the way it did as a plain <div>. */
.ccb {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0;
  max-width: none;
  max-height: none;
  width: auto;
  padding: 0.85rem 1.2rem;
  background: var(--surface);
  border: 0;
  border-top: 1px solid var(--border);
  color: var(--text);
  font-size: 0.85rem;
  box-shadow: 0 -4px 14px rgba(0, 0, 0, 0.08);
}
.ccb-text {
  flex: 1;
  min-width: 0;
}
.ccb-link {
  color: var(--accent);
  text-decoration: underline;
  margin-left: 0.3rem;
}
.ccb-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}
.ccb-btn {
  padding: 0.45rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s;
}
.ccb-btn--decline {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
}
.ccb-btn--decline:hover {
  background: var(--bg);
}
.ccb-btn--accept {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: #fff;
}
.ccb-btn--accept:hover {
  opacity: 0.9;
}
@media (max-width: 640px) {
  .ccb {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    padding: 1rem;
  }
  .ccb-actions {
    justify-content: flex-end;
  }
}
</style>
