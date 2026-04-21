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

  const html = await renderToString(app, context)
  const jsonLd = buildJsonLd(currentRoute, context)
  // Prefer the request's actual host for absolute URLs (og:url, og:image,
  // canonical).  Falls back to CANONICAL_URL (env) or the hard default.
  // This is why WhatsApp / Slack / etc. couldn't fetch og:image: the
  // static index.html pinned `fontem.eu` but the site was served at
  // `gmr.void42.net`, where fontem.eu DNS didn't point. Now every
  // render self-anchors to whatever host the request came in on.
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
