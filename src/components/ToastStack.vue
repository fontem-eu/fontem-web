<script setup>
/**
 * Toast renderer. Mount once near the app shell — everything else
 * dispatches via the `useToast()` composable. Renders the queue in
 * the bottom-right corner of the viewport (above the cookie banner
 * thanks to the `--cookie-banner-h` CSS var the banner publishes;
 * see CookieConsentBanner.vue), one card per toast, click to dismiss.
 */
import { useToast } from '../composables/useToast.js'

const toast = useToast()
const toasts = toast._toasts
</script>

<template>
  <Teleport to="body">
    <output
      v-if="toasts.length"
      class="toast-stack"
      data-testid="toast-stack"
    >
      <button
        v-for="t in toasts"
        :key="t.id"
        type="button"
        class="toast"
        :class="`toast--${t.kind}`"
        :data-testid="`toast-${t.kind}`"
        :data-toast-id="t.id"
        @click="toast.dismiss(t.id)"
      >
        <span class="toast-icon" aria-hidden="true">
          <template v-if="t.kind === 'success'">✓</template>
          <template v-else-if="t.kind === 'error'">✕</template>
          <template v-else>i</template>
        </span>
        <span class="toast-text">{{ t.text }}</span>
      </button>
    </output>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  right: 1rem;
  /* Sit above the cookie consent banner — the banner publishes its
     rendered height to `--cookie-banner-h` (see CookieConsentBanner). */
  bottom: calc(1rem + var(--cookie-banner-h, 0px));
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 1100;
  max-width: min(360px, calc(100vw - 2rem));
}
.toast {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.85rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  animation: toast-in 160ms ease-out;
}
.toast:hover { background: var(--bg); }
.toast-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.toast--success .toast-icon { background: #15803d; }
.toast--error   .toast-icon { background: #b91c1c; }
.toast--info    .toast-icon { background: var(--accent); }
.toast-text { line-height: 1.25; }

@keyframes toast-in {
  from { transform: translateY(8px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
</style>
