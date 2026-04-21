/**
 * Render entry — imported by scripts/prerender.js at build time.
 *
 * Runs the Vue app through vue/server-renderer's renderToString for a
 * given URL and returns { html, head } with per-route meta. No runtime
 * server uses this anymore; everything is baked into static HTML at
 * build time and served by nginx.
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

  const html = await renderToString(app, context)
  const jsonLd = buildJsonLd(currentRoute, context)
  // Build absolute URLs (og:url, canonical, og:image) from the origin
  // the prerender script passes in — production bakes `www.fontem.eu`.
  // The defensive fallback to CANONICAL_URL env stays for local dev +
  // preview runs where no request context is supplied.
  const origin = absoluteOrigin(context.requestHost, context.requestProto)
  const head = {
    title: titleForPath(currentRoute),
    description: descriptionForPath(currentRoute),
    jsonLd,
    canonical: `${origin}${url}`,
    origin,
    ogImage: `${origin}/og-card.png`,
  }
  return { html, head }
}

function absoluteOrigin(requestHost, requestProto) {
  if (requestHost) {
    const scheme = requestProto || 'https'
    return `${scheme}://${requestHost}`
  }
  const fallback = globalThis.process?.env?.CANONICAL_URL || 'https://www.fontem.eu'
  return fallback.replace(/\/$/, '')
}
