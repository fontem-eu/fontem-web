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
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const visible = ref(false)
const STORAGE_KEY = 'gmr-cookie-consent'
// Approximation of the banner's rendered height (text + actions + padding).
// Measured ~52 px at full viewport, ~96 px at a narrow mobile viewport
// where the actions wrap below the text. The "safer" value is the larger
// one — that just leaves a little extra space on desktop, which is fine.
const BANNER_HEIGHT = '6rem'

function applyOffset(shown) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty(
    '--cookie-banner-h',
    shown ? BANNER_HEIGHT : '0px',
  )
}

onMounted(() => {
  if (typeof localStorage === 'undefined') return
  const choice = localStorage.getItem(STORAGE_KEY)
  if (choice !== 'accepted' && choice !== 'declined') {
    visible.value = true
  }
})

onBeforeUnmount(() => applyOffset(false))

watch(visible, applyOffset, { immediate: true })

function accept() {
  localStorage.setItem(STORAGE_KEY, 'accepted')
  visible.value = false
}

function decline() {
  localStorage.setItem(STORAGE_KEY, 'declined')
  visible.value = false
}
</script>

<template>
  <Teleport to="body">
    <dialog v-if="visible" open class="ccb" aria-label="Cookie consent" data-testid="cookie-consent-banner">
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
