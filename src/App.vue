<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from './composables/useTheme.js'
import { useSwipeNav } from './composables/useSwipeNav.js'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import CookieConsentBanner from './components/CookieConsentBanner.vue'

const { init } = useTheme()
// Sync the reactive ref with whatever the anti-FOUC script set on <html>
onMounted(() => init())

// Horizontal swipe between Home / Feed / My Reports on mobile.
useSwipeNav()

const route = useRoute()
// Footer is visible everywhere except the login page (where it would
// displace the form and add link noise during sign-in).
const showFooter = computed(() => route.path !== '/login')
</script>

<template>
  <div class="min-h-screen app-shell" style="background: var(--bg)">
    <!-- Skip-link: first focusable element on every page.  Hidden until
         keyboard focus lands on it.  Pressing Enter jumps past the
         header + nav straight to the page's main content — the single
         biggest keyboard-a11y win for an SPA with a persistent nav. -->
    <a href="#main" class="skip-link" data-testid="skip-to-main">
      Skip to main content
    </a>
    <AppHeader />
    <main id="main" tabindex="-1">
      <router-view />
    </main>
    <AppFooter v-if="showFooter" />
    <CookieConsentBanner />
  </div>
</template>

<style>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.app-shell > main {
  flex: 1 0 auto;
}
.app-shell > .app-footer {
  margin-top: auto;
}

/* Focusable main — when the skip-link is used, #main receives focus.
   We don't want a default focus ring on a container, so suppress it
   only on the landmark itself (still visible on children). */
main#main:focus { outline: none; }

/* Skip-link — off-screen by default, visible on keyboard focus.
   Styled for contrast in both themes via theme tokens. */
.skip-link {
  position: absolute;
  top: 0;
  left: 0;
  padding: 0.5rem 1rem;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  border-radius: 0 0 4px 0;
  text-decoration: none;
  transform: translateY(-110%);
  transition: transform 0.15s;
  z-index: 100;
}
.skip-link:focus {
  transform: translateY(0);
  outline: 2px solid var(--text);
  outline-offset: 2px;
}
</style>
