/**
 * Runtime SSR for the content routes.
 *
 * The rest of the site is baked at build time (scripts/prerender.js) and
 * served by nginx as static files — that stays true and is still the
 * right call for pages whose content only changes on deploy.
 *
 * These routes cannot work that way. A story is published by a user
 * minutes after a deploy, and there are millions of companies and
 * contracts; neither can be enumerated into static files. So they render
 * per request, here.
 *
 * Why it has to render at all, rather than just serving meta: GPTBot,
 * ClaudeBot, PerplexityBot and CCBot execute no JavaScript. Our
 * robots.txt invites all four explicitly. Without server rendering they
 * arrive at an empty shell — the welcome mat is out for a room with
 * nothing in it.
 *
 * Failure is never fatal to the response. Every error path falls back to
 * the SPA shell, which is exactly what the site served before this
 * existed: a browser hydrates it and the reader sees the page. A crawler
 * gets less, which is worth strictly more than a 502.
 */
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderHead } from '../src/ssr/head.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = process.env.SSR_DIST || path.join(ROOT, 'dist')
const PORT = Number(process.env.SSR_PORT || 8081)
const CANONICAL = (process.env.CANONICAL_URL || 'https://fontem.eu').replace(/\/$/, '')
const CAPI = (process.env.SSR_API_ORIGIN || '').replace(/\/$/, '')

// A render costs a Vue mount plus an upstream fetch. Crawlers arrive in
// bursts on the same URLs, so a short TTL absorbs the burst without
// holding anything long enough to serve visibly stale prose.
const CACHE_TTL_MS = Number(process.env.SSR_CACHE_TTL_MS || 60_000)
const CACHE_MAX = Number(process.env.SSR_CACHE_MAX || 500)
// Upstream is in-cluster; if it cannot answer quickly the shell is the
// better answer. This bound is what stops a slow API becoming a slow site.
const FETCH_TIMEOUT_MS = Number(process.env.SSR_FETCH_TIMEOUT_MS || 3000)
const RENDER_TIMEOUT_MS = Number(process.env.SSR_RENDER_TIMEOUT_MS || 5000)

const STORY_RE = /^\/stories\/([^/]+)\/?$/

const cache = new Map()

function cacheGet(key) {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expires) { cache.delete(key); return null }
  return hit.html
}

function cacheSet(key, html) {
  // Oldest-first eviction; insertion order is Map's iteration order.
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
  cache.set(key, { html, expires: Date.now() + CACHE_TTL_MS })
}

async function withTimeout(promise, ms, label) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** The published story, or null. Never throws. */
async function fetchStory(id) {
  if (!CAPI) return null
  try {
    const res = await withTimeout(
      fetch(`${CAPI}/capi/data-stories/${encodeURIComponent(id)}`),
      FETCH_TIMEOUT_MS, 'story fetch')
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function renderStory(render, template, shell, url, id) {
  const story = await fetchStory(id)
  // No story — a bad id, a draft, or the API being slow. The shell is
  // right: it carries no canonical, so nothing claims this URL is a
  // page that exists.
  if (!story) return shell

  const u = new URL(CANONICAL)
  const ctx = {
    story,
    requestHost: u.host,
    requestProto: u.protocol.replace(':', ''),
  }
  const { html, head } = await withTimeout(render(url, ctx), RENDER_TIMEOUT_MS, 'render')
  return template
    .replace(/<!--ssr-head-->[\s\S]*?<!--\/ssr-head-->/, renderHead(head))
    .replace('<!--ssr-outlet-->', html)
}

async function main() {
  const { render } = await import(path.join(DIST, 'server/entry-server.js'))
  const template = await fs.readFile(path.join(DIST, 'client/index.html'), 'utf-8')
  const shell = await fs.readFile(path.join(DIST, 'client/spa.html'), 'utf-8')

  const server = http.createServer(async (req, res) => {
    const url = (req.url || '/').split('?')[0]

    if (url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
      return
    }

    const send = (html, cached) => {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        // Same posture as the static HTML: personalised once hydrated,
        // so never in a shared cache.
        'Cache-Control': 'no-store',
        'X-SSR-Cache': cached ? 'hit' : 'miss',
      })
      res.end(html)
    }

    try {
      const story = STORY_RE.exec(url)
      if (!story) { send(shell, false); return }

      const hit = cacheGet(url)
      if (hit) { send(hit, true); return }

      const html = await renderStory(render, template, shell, url, story[1])
      if (html !== shell) cacheSet(url, html)
      send(html, false)
    } catch (err) {
      // Renders must not take the page down. Serving the shell here is
      // the behaviour the site had before SSR existed.
      console.error(`ssr: ${url}: ${err?.message || err}`)
      send(shell, false)
    }
  })

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`ssr listening on :${PORT} (api=${CAPI || 'unset'}, canonical=${CANONICAL})`)
  })
}

main().catch((err) => {
  console.error('ssr failed to start:', err)
  process.exit(1)
})
