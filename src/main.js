/**
 * Client entrypoint. The shared app factory lives in ./app.js so the
 * build-time prerender script can import the same router + component
 * graph via ./entry-server.js.
 */
import { createFontemApp } from './app.js'
import { restoreSession } from './api/session.js'
import { useAnalytics } from './composables/useAnalytics.js'

const { app, router } = createFontemApp(false)

// Silently refresh the session on every cold page load. If the user
// has a live refresh cookie (legitimate browser session), this
// restores an in-memory access token before the first /capi call
// fires — no flash of "signed in -> not signed in -> signed in"
// during navigation. If the cookie's gone, the refresh fails and
// the session store stays anonymous; the router gate redirects to
// /login on the first protected route. The API client awaits this
// same restore (whenSessionReady) before its first request, so a
// data fetch can't beat the token into place and go out anonymous.
restoreSession()

// Page-view tracking — client only; the analytics composable handles
// its own consent + dev-mode guards.
const { page } = useAnalytics()
router.afterEach((to) => { page(to.fullPath) })

router.isReady().then(() => {
  // Mount over whatever prerendered HTML lives in #app; Vue's
  // mismatch-tolerant mount takes care of replacing it with the live
  // reactive tree while keeping the first-paint markup intact.
  app.mount('#app', true)
})
