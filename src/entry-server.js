/**
 * SSR entry — imported by the Fastify server for each request.
 *
 * Creates a fresh Vue SSR app per request (Vue 3 requires this so two
 * requests don't share reactive state), installs the router, navigates
 * to the URL, and returns the rendered HTML plus any per-page meta the
 * render collected (title, description, JSON-LD).
 */
import { renderToString } from 'vue/server-renderer'
import { createFontemApp } from './app.js'
import { buildJsonLd } from './ssr/jsonLd.js'
import { titleForPath, descriptionForPath } from './ssr/meta.js'

/**
 * Render one request.  Returns { html, head } where `head` carries the
 * per-page `<title>`, `<meta name="description">`, and JSON-LD that
 * the server injects into the HTML template.
 */
export async function render(url, context = {}) {
  const { app, router } = createFontemApp(true)

  // Drive Vue Router to the target URL — this resolves which view
  // component gets rendered by <router-view>.
  await router.push(url)
  await router.isReady()

  const currentRoute = router.currentRoute.value
  const matched = currentRoute.matched[0]
  if (!matched) {
    // Unmatched routes fall through to the 404 view via the catch-all
    // at the bottom of the route table.
  }

  const html = await renderToString(app, context)
  const jsonLd = buildJsonLd(currentRoute, context)
  const head = {
    title: titleForPath(currentRoute),
    description: descriptionForPath(currentRoute),
    jsonLd,
    canonical: canonicalUrl(url),
  }
  return { html, head }
}

function canonicalUrl(path) {
  const origin = (globalThis.process?.env?.CANONICAL_URL || 'https://fontem.eu').replace(/\/$/, '')
  return `${origin}${path}`
}
