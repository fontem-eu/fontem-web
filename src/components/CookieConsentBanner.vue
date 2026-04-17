<script setup>
/**
 * Cookie consent banner — shown until the user makes a choice.
 *
 * Persists choice in localStorage as 'gmr-cookie-consent' = 'accepted' | 'declined'.
 * Until 'accepted' is set, useAnalytics() is a no-op (see composables/useAnalytics.js).
 */
import { ref, onMounted } from 'vue'

const visible = ref(false)
const STORAGE_KEY = 'gmr-cookie-consent'

onMounted(() => {
  if (typeof localStorage === 'undefined') return
  const choice = localStorage.getItem(STORAGE_KEY)
  if (choice !== 'accepted' && choice !== 'declined') {
    visible.value = true
  }
})

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
    <div v-if="visible" class="ccb" role="dialog" aria-label="Cookie consent" data-testid="cookie-consent-banner">
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
    </div>
  </Teleport>
</template>

<style scoped>
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
  padding: 0.85rem 1.2rem;
  background: var(--surface);
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
