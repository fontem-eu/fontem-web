/**
 * Build-time prerender.
 *
 * Runs after `vite build --ssr` produces the server bundle.  For each
 * route in SSR_ROUTES, calls render() to produce HTML + head metadata,
 * then writes that as a static file under dist/client/ so nginx can
 * serve it directly.  No runtime SSR — everything is baked.
 *
 * Routes are picked for SEO value (the pages crawlers should index
 * with real content).  Everything else stays pure SPA, served from
 * /index.html via nginx's `try_files` fallback.
 *
 * Usage (called from `npm run build`):
 *   node scripts/prerender.js
 *
 * Why this instead of full SSR:
 * - Ops: nginx static image, no Node runtime, no port mismatches.
 * - Performance: CDN-friendly, every response is a file.
 * - Crawler benefit is identical — the rendered HTML is the same
 *   bytes either way, just produced at different times.
 */
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

// Canonical origin baked into prerendered HTML (og:url, canonical,
// og:image). Overridable per env; production defaults to www.fontem.eu
// since that's the DNS we actually have wired.
const CANONICAL = (process.env.CANONICAL_URL || 'https://www.fontem.eu').replace(/\/$/, '')

// Routes to prerender. Must match the set we want crawlers to index
// with real content — the transparency surface, basically. Anything
// dynamic (`/reports/:id`, `/c/:ticker`) stays SPA.
const ROUTES = ['/', '/feed', '/privacy', '/data-quality', '/sparql']

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function renderHead(head) {
  const parts = []
  if (head.title) {
    parts.push(`<title>${escapeHtml(head.title)}</title>`)
    parts.push(`<meta property="og:title" content="${escapeHtml(head.title)}"/>`)
    parts.push(`<meta name="twitter:title" content="${escapeHtml(head.title)}"/>`)
  }
  if (head.description) {
    parts.push(`<meta name="description" content="${escapeHtml(head.description)}"/>`)
    parts.push(`<meta property="og:description" content="${escapeHtml(head.description)}"/>`)
    parts.push(`<meta name="twitter:description" content="${escapeHtml(head.description)}"/>`)
  }
  if (head.canonical) {
    parts.push(`<link rel="canonical" href="${escapeHtml(head.canonical)}"/>`)
    parts.push(`<meta property="og:url" content="${escapeHtml(head.canonical)}"/>`)
  }
  if (head.ogImage) {
    parts.push(`<meta property="og:image" content="${escapeHtml(head.ogImage)}"/>`)
    parts.push(`<meta name="twitter:image" content="${escapeHtml(head.ogImage)}"/>`)
  }
  for (const doc of (head.jsonLd || [])) {
    parts.push(`<script type="application/ld+json">${JSON.stringify(doc)}</script>`)
  }
  return parts.join('\n    ')
}

async function main() {
  // The server bundle produced by `vite build --ssr`.
  const { render } = await import(path.join(ROOT, 'dist/server/entry-server.js'))

  // Template from the client build.  We inject per-route head into
  // the <!--ssr-head--> marker and the rendered tree into <!--ssr-outlet-->.
  const template = await fs.readFile(path.join(ROOT, 'dist/client/index.html'), 'utf-8')

  for (const route of ROUTES) {
    // Construct an origin-matched render context.  CANONICAL env var
    // controls what hostname we bake in.
    const u = new URL(CANONICAL)
    const ctx = { requestHost: u.host, requestProto: u.protocol.replace(':', '') }
    const { html, head } = await render(route, ctx)

    const finalHtml = template
      .replace(/<!--ssr-head-->[\s\S]*?<!--\/ssr-head-->/, renderHead(head))
      .replace('<!--ssr-outlet-->', html)

    const outDir = route === '/'
      ? path.join(ROOT, 'dist/client')
      : path.join(ROOT, 'dist/client', route)
    const outFile = path.join(outDir, 'index.html')

    await fs.mkdir(outDir, { recursive: true })
    await fs.writeFile(outFile, finalHtml, 'utf-8')

    // eslint-disable-next-line no-console
    console.log(`  prerendered ${route.padEnd(16)} → ${path.relative(ROOT, outFile)}`)
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('prerender failed:', err)
  process.exit(1)
})
