/**
 * Fontem Fastify SSR server.
 *
 * Responsibilities:
 *   1. Serve the SSR-rendered HTML for every non-asset GET.
 *   2. Proxy `/api`, `/capi`, `/uploads`, `/umami`, `/sitemap*.xml` to
 *      the in-cluster services (replaces the old nginx location rules).
 *   3. Serve the client bundle + static assets (icons, fonts, etc.).
 *
 * Runs in two modes:
 *   - dev  (`NODE_ENV !== 'production'`): Vite middleware mode with HMR.
 *   - prod (`NODE_ENV === 'production'`): built bundles under `dist/`.
 *
 * Port: 8080 by default; the container's K8s Service points at this.
 */
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import fastifyProxy from '@fastify/http-proxy'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const IS_PROD = process.env.NODE_ENV === 'production'
const PORT = Number(process.env.PORT || 8080)

// Upstream service URLs.  In-cluster DNS in prod; configurable for dev.
const CAPI_URL = process.env.CAPI_URL
  || `http://gmr-community-api.${process.env.POD_NAMESPACE || 'gmr-dev'}.svc.cluster.local:8001`
const API_URL = process.env.API_URL
  || `http://gmr-api.${process.env.POD_NAMESPACE || 'gmr-dev'}.svc.cluster.local`
const MINIO_URL = process.env.MINIO_URL
  || `http://minio.${process.env.POD_NAMESPACE || 'gmr-dev'}.svc.cluster.local:9000`
const UMAMI_URL = process.env.UMAMI_URL
  || `http://umami.monitoring.svc.cluster.local`

// Routes we render server-side. Everything else gets the SPA shell —
// Vue hydrates on the client. Starting conservative: only the
// definitely-safe routes on the first pass.
const SSR_ROUTES = new Set(['/', '/feed', '/privacy', '/data-quality', '/sparql'])

async function buildServer() {
  const fastify = Fastify({
    logger: { level: IS_PROD ? 'info' : 'warn' },
    trustProxy: true,
    disableRequestLogging: true,
  })

  // ── Proxies ────────────────────────────────────────────────────
  // These mirror the retired nginx.conf location blocks so existing
  // frontend fetch paths keep working.

  await fastify.register(fastifyProxy, {
    upstream: CAPI_URL, prefix: '/capi', rewritePrefix: '',
    http2: false,
    replyOptions: { rewriteRequestHeaders: (_req, headers) => headers },
  })

  await fastify.register(fastifyProxy, {
    upstream: API_URL, prefix: '/api', rewritePrefix: '',
    http2: false,
  })

  await fastify.register(fastifyProxy, {
    upstream: MINIO_URL, prefix: '/uploads', rewritePrefix: '/gmr-uploads',
    http2: false,
  })

  await fastify.register(fastifyProxy, {
    upstream: UMAMI_URL, prefix: '/umami', rewritePrefix: '',
    http2: false,
  })

  // Sitemap lives on the community API; expose it at the origin root
  // so crawlers don't see a `/capi/` prefix.
  for (const file of ['/sitemap.xml', '/sitemap-core.xml', '/sitemap-reports.xml']) {
    fastify.get(file, async (req, reply) => {
      const res = await fetch(`${CAPI_URL}${file}`)
      const body = await res.text()
      reply
        .header('Content-Type', 'application/xml; charset=utf-8')
        .header('Cache-Control', 'public, max-age=3600')
        .code(res.status)
        .send(body)
    })
  }

  // ── SSR / static ───────────────────────────────────────────────

  let vite
  let ssrRender
  let template

  if (IS_PROD) {
    // Prod: static bundle + precompiled SSR entry.
    template = await fs.readFile(path.join(ROOT, 'dist/client/index.html'), 'utf-8')
    const mod = await import(path.join(ROOT, 'dist/server/entry-server.js'))
    ssrRender = mod.render

    await fastify.register(fastifyStatic, {
      root: path.join(ROOT, 'dist/client'),
      prefix: '/',
      decorateReply: false,
      wildcard: false,
      index: false,
    })
  } else {
    // Dev: Vite in middleware mode with HMR.
    const { createServer } = await import('vite')
    vite = await createServer({
      root: ROOT,
      server: { middlewareMode: true },
      appType: 'custom',
    })
    fastify.addHook('onRequest', async (req, reply) => {
      await new Promise((resolve) => vite.middlewares(req.raw, reply.raw, resolve))
    })
  }

  // Set strict security headers on all HTML responses. Stays aligned
  // with the CSP we shipped via nginx; asset responses inherit from
  // the static handler.
  fastify.addHook('onSend', async (req, reply, payload) => {
    const ct = reply.getHeader('content-type')
    if (typeof ct === 'string' && ct.startsWith('text/html')) {
      reply.header('X-Content-Type-Options', 'nosniff')
      reply.header('X-Frame-Options', 'DENY')
      reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
      reply.header(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' https://accounts.google.com; " +
        "worker-src 'self' blob:; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob: https://tile.openstreetmap.org; " +
        "connect-src 'self' https://accounts.google.com https://tile.openstreetmap.org; " +
        "font-src 'self'; " +
        "frame-src https://accounts.google.com; " +
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
      )
    }
    return payload
  })

  // Catch-all handler — every non-proxied, non-asset request goes
  // through the Vue router via SSR.
  fastify.get('/*', async (req, reply) => {
    const url = req.url.split('?')[0]
    void reply // keep `reply` in scope for clarity — handler sends below.

    // If the URL points at a specific asset (has a dot-ext) and we
    // reached this handler, it's a genuine 404 for a static file.
    if (/\.[a-z0-9]+$/i.test(url) && url !== '/') {
      reply.code(404).send('Not found')
      return
    }

    try {
      let html = template
      let render = ssrRender

      if (!IS_PROD) {
        html = await vite.transformIndexHtml(url, await fs.readFile(path.join(ROOT, 'index.html'), 'utf-8'))
        const mod = await vite.ssrLoadModule('/src/entry-server.js')
        render = mod.render
      }

      const shouldSSR = SSR_ROUTES.has(url)
      const rendered = shouldSSR
        ? await render(url, {})
        : { html: '', head: { title: null, description: null, jsonLd: [], canonical: null } }

      const headHtml = renderHead(rendered.head, url)
      const finalHtml = html
        .replace(/<!--ssr-head-->[\s\S]*?<!--\/ssr-head-->/, headHtml)
        .replace('<!--ssr-outlet-->', rendered.html)

      reply.header('Content-Type', 'text/html; charset=utf-8').send(finalHtml)
    } catch (err) {
      if (!IS_PROD && vite) vite.ssrFixStacktrace(err)
      fastify.log.error({ err, url }, 'SSR render failed')
      reply.code(500).send(err.stack || err.message)
    }
  })

  // Health check — plain /health endpoint for readiness probes.
  fastify.get('/health', async () => ({ status: 'ok' }))

  return fastify
}

/**
 * Serialize the per-page head block (title + description + JSON-LD +
 * canonical) into the HTML that replaces the `<!--ssr-head-->` marker.
 * Hand-escaped; we control both sides so no HTML injection surface.
 */
// eslint-disable-next-line no-unused-vars
function renderHead(head, url) {
  const parts = []
  if (head.title) parts.push(`<title>${escapeHtml(head.title)}</title>`)
  if (head.description) {
    parts.push(
      `<meta name="description" content="${escapeHtml(head.description)}"/>`
    )
  }
  if (head.canonical) {
    parts.push(`<link rel="canonical" href="${escapeHtml(head.canonical)}"/>`)
  }
  for (const doc of (head.jsonLd || [])) {
    parts.push(
      `<script type="application/ld+json">${JSON.stringify(doc)}</script>`
    )
  }
  return parts.join('\n    ')
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── main ──────────────────────────────────────────────────────────

buildServer()
  .then(async (fastify) => {
    await fastify.listen({ port: PORT, host: '0.0.0.0' })
    // eslint-disable-next-line no-console
    console.log(`Fontem SSR server listening on :${PORT} (${IS_PROD ? 'prod' : 'dev'})`)
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err)
    process.exit(1)
  })
