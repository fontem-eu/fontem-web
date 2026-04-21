/**
 * Client entrypoint.  The shared app factory lives in ./app.js so the
 * SSR hook can import the same router + component graph.  All code
 * that needs `window` / `localStorage` lives below.
 */
import { createFontemApp } from './app.js'
import { useAnalytics } from './composables/useAnalytics.js'

const { app, router } = createFontemApp(false)

// Page-view tracking — client only; the analytics composable handles
// its own consent + dev-mode guards.
const { page } = useAnalytics()
router.afterEach((to) => { page(to.fullPath) })

// Wait for route-from-URL resolution before mounting so we mount
// against the correct view on first paint (avoids a brief 404 flash
// on deep links).
router.isReady().then(() => {
  // Vike / SSR path will have pre-rendered into #app; hydrate rather
  // than mount when the server supplied HTML.  Easiest signal: look
  // for a child node.  Vue handles hydrateOnMismatch gracefully.
  app.mount('#app', true)
})
