/**
 * Client entrypoint. The shared app factory lives in ./app.js so the
 * build-time prerender script can import the same router + component
 * graph via ./entry-server.js.
 */
import { createFontemApp } from './app.js'
import { useAnalytics } from './composables/useAnalytics.js'

const { app, router } = createFontemApp(false)

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
