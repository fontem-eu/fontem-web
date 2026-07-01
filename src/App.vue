<script setup>
import { computed, inject, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from './composables/useTheme.js'
import { useLang } from './composables/useLang.js'
import { useSwipeNav } from './composables/useSwipeNav.js'
import { useDocumentMeta } from './composables/useDocumentMeta.js'
import AppHeader from './components/AppHeader.vue'
import AppSidebar from './components/AppSidebar.vue'
import AppFooter from './components/AppFooter.vue'
import VerifyEmailBanner from './components/VerifyEmailBanner.vue'
import CookieConsentBanner from './components/CookieConsentBanner.vue'
import ToastStack from './components/ToastStack.vue'
import I18nPluralProbe from './components/I18nPluralProbe.vue'

const { init: initTheme } = useTheme()
const { init: initLang } = useLang()
// Resolve the i18n instance now (in setup) — must come from the
// `fontem-i18n` provide we set in app.js. globalProperties.$i18n is
// a property-wrapper without `.global` / `setLocaleMessage`, which
// is what activateLocale needs when a locale is lazy-loaded.
const fontemI18n = inject('fontem-i18n', null)
onMounted(() => {
  initTheme()
  initLang(fontemI18n)
})

// Horizontal swipe between Home / Feed / My Reports on mobile.
useSwipeNav()

// Per-route document.title + meta description, reactive to locale switch.
useDocumentMeta()

const route = useRoute()
// Footer is visible everywhere except the login page (where it would
// displace the form and add link noise during sign-in).
const showFooter = computed(() => route.path !== '/login')
const showSidebar = computed(() => route.path !== '/login')
</script>

<template>
  <div class="min-h-screen app-shell" style="background: var(--bg)">
    <!-- Skip-link: first focusable element on every page.  Hidden until
         keyboard focus lands on it.  Pressing Enter jumps past the
         header + nav straight to the page's main content — the single
         biggest keyboard-a11y win for an SPA with a persistent nav. -->
    <a href="#main" class="skip-link" data-testid="skip-to-main">{{ $t('app.skip_to_main_content') }}</a>
    <AppHeader />
    <VerifyEmailBanner />
    <I18nPluralProbe />
    <div class="app-body">
      <AppSidebar v-if="showSidebar" />
      <div class="app-content">
        <main id="main" tabindex="-1">
          <router-view />
        </main>
        <AppFooter v-if="showFooter" />
      </div>
    </div>
    <CookieConsentBanner />
    <ToastStack />
  </div>
</template>

<style>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  --bezel-h: 3.25rem;
}
.app-body { display: flex; align-items: stretch; flex: 1 0 auto; min-height: 0; }
.app-content { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.app-content > main { flex: 1 0 auto; }
.app-content > .app-footer { margin-top: auto; }

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
