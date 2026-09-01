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

import { renderHead } from '../src/ssr/head.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

// Canonical origin baked into prerendered HTML (og:url, canonical,
// og:image). Apex, not www: robots.txt and the sitemap both publish
// apex URLs, and nginx 301s www -> apex, so the canonical has to agree
// with them or we hand Google three different answers to "which URL is
// this page".
const CANONICAL = (process.env.CANONICAL_URL || 'https://fontem.eu').replace(/\/$/, '')

// Routes to prerender. Must match the set we want crawlers to index
// with real content — the transparency surface, basically. Anything
// dynamic (`/reports/:id`, `/c/:ticker`) stays SPA.
const ROUTES = ['/', '/about', '/privacy', '/data-quality', '/sparql', '/development']

/**
 * The SPA fallback shell.
 *
 * nginx used to fall back to `/index.html`, which IS the prerendered
 * homepage — so every route without its own file (`/stories/:id`,
 * `/company/:gmr_id`, every entity page) served the homepage's
 * `<title>`, description, JSON-LD and, worst of all, its canonical.
 * A canonical pointing at `/` tells Google the page IS the homepage,
 * which is a direct instruction not to index it — while sitemap-stories
 * was busy submitting those exact URLs.
 *
 * This shell carries the site defaults and NO canonical: absent is
 * correct, because Google then uses the request URL, which is the right
 * answer for every one of these routes. No JSON-LD either — the
 * landing's ItemList describes the feed, not whatever page fell back.
 */
async function writeSpaShell(render, template) {
  const u = new URL(CANONICAL)
  const ctx = { requestHost: u.host, requestProto: u.protocol.replace(':', '') }
  // An unrouted path so titleForPath/descriptionForPath yield the
  // site defaults rather than any one page's copy.
  const { head } = await render('/__spa_shell__', ctx)
  const shell = template
    .replace(/<!--ssr-head-->[\s\S]*?<!--\/ssr-head-->/,
      renderHead({ ...head, jsonLd: [] }, { canonical: false }))
    .replace('<!--ssr-outlet-->', '')
  const outFile = path.join(ROOT, 'dist/client/spa.html')
  await fs.writeFile(outFile, shell, 'utf-8')
  // eslint-disable-next-line no-console
  console.log(`  prerendered ${'(spa fallback)'.padEnd(16)} → ${path.relative(ROOT, outFile)}`)
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

  await writeSpaShell(render, template)
}

main().catch((err) => {
  console.error('prerender failed:', err)
  process.exit(1)
})
