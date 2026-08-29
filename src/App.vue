<script setup>
import { computed, inject, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from './composables/useTheme.js'
import { useLang } from './composables/useLang.js'
import { useSwipeNav } from './composables/useSwipeNav.js'
import { useDocumentMeta } from './composables/useDocumentMeta.js'
import AppHeader from './components/AppHeader.vue'
import AppSidebar from './components/AppSidebar.vue'
import { useSidebar } from './composables/useSidebar.js'
import { useVisibleViewportHeight } from './composables/useVisibleViewportHeight.js'
import AppFooter from './components/AppFooter.vue'
import VerifyEmailBanner from './components/VerifyEmailBanner.vue'
import CookieConsentBanner from './components/CookieConsentBanner.vue'
import AssistPanel from './components/AssistPanel.vue'
import ToastStack from './components/ToastStack.vue'
import { rateLimited } from './api/_retry.js'
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
// Hidden on /login only: an assistant that can navigate the app is no use
// to someone who cannot yet get into it, and the panel's own requests need
// a token anyway.
const showAssistant = computed(() => route.path !== '/login')
const { collapsed } = useSidebar()

// Publishes --visible-vh for the whole app. Only the assistant's own
// full-height panel uses it now — the rail and the toggle moved to static
// svh/lvh units, because anything that tracks the address bar live moves
// on every scroll. The shell is still where a document-level variable
// belongs.
useVisibleViewportHeight()
</script>

<template>
  <div class="min-h-screen app-shell" :class="{ 'shell-has-rail': showSidebar, 'shell-rail-collapsed': collapsed }" style="background: var(--bg)">
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
    <!-- The platform rate-limits its own API per client IP. When a burst
         trips it, the retry wrapper absorbs the 429 — this note is the
         only sign it happened, instead of a silently empty widget. -->
    <div
      v-if="rateLimited"
      class="rate-limited-note"
      role="status"
      data-testid="rate-limited-note"
    >
      {{ $t('app.rate_limited_retrying') }}
    </div>
    <!-- The assistant is part of the shell, not of any one page. It was
         mounted inside ReportEditorView, so it existed only while you were
         editing an article — the one moment you least need help finding
         your way around. It teleports to <body> and owns its own toggle,
         so the shell renders it once; editing surfaces publish their state
         through useAssistantContext rather than passing props down. -->
    <AssistPanel v-if="showAssistant" />
  </div>
</template>

<style>
.rate-limited-note {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 60;
  padding: 6px 16px;
  font-size: 0.8rem;
  text-align: center;
  color: #7f1d1d;
  background: #fee2e2;
  border-top: 1px solid #fca5a5;
}
.dark .rate-limited-note {
  color: #fecaca;
  background: #450a0a;
  border-top-color: #7f1d1d;
}

.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  --bezel-h: 3.25rem;
}
@media (min-width: 900px) {
  .app-shell.shell-has-rail { --rail-w: 15rem; }
  .app-shell.shell-has-rail.shell-rail-collapsed { --rail-w: 3.5rem; }
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
