/**
 * Client entrypoint. The shared app factory lives in ./app.js so the
 * build-time prerender script can import the same router + component
 * graph via ./entry-server.js.
 */
import { createDargleApp } from './app.js'
import { restoreSession } from './api/session.js'
import { useAnalytics } from './composables/useAnalytics.js'
import { useLang } from './composables/useLang.js'

const { app, router, i18n } = createDargleApp(false)

// Settle the UI language before anything mounts. Every API call carries
// it (withLang), and a page sends its first requests while mounting —
// before App.vue's own onMounted, which is where this used to happen.
// Those requests went out with no language, and every page that follows
// the language then loaded a second time when it arrived: twice the
// requests, and whichever answer came back last was the one shown.
useLang().init(i18n)

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
