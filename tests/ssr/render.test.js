/**
 * SSR snapshot tests — pins what gets shipped to crawlers.
 *
 * We call the server-side `render()` directly (no HTTP) for each
 * route we've committed to serving SSR. The rendered HTML must:
 *   - contain the real content (so non-JS crawlers see it)
 *   - carry a sensible <title> and <meta description>
 *   - carry at least one JSON-LD block with a valid schema.org @type
 *
 * These tests lock the contract across every refactor of the view
 * components — if a regression drops content below the fold, this
 * fires.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'

// useAnalytics calls window.navigator at import time in some paths;
// provide a stub before importing the app factory.
beforeAll(() => {
  globalThis.document = globalThis.document || { title: '' }
  globalThis.window = globalThis.window || {}
})

// Mock the analytics composable — it expects a browser environment.
vi.mock('../../src/composables/useAnalytics.js', () => ({
  useAnalytics: () => ({ page: vi.fn(), track: vi.fn() }),
}))

const { render } = await import('../../src/entry-server.js')

describe('SSR render — landing (/)', () => {
  it('renders real content, not an empty shell', async () => {
    const { html, head } = await render('/')
    // The landing card's search input + logo wordmark should be in
    // the HTML even with JS off.
    expect(html).toContain('data-testid="landing"')
    expect(html).toMatch(/wordmark/i)
    // Head: title + description + at least one JSON-LD doc
    expect(head.title).toBeTruthy()
    expect(head.description).toBeTruthy()
    expect(head.jsonLd.length).toBeGreaterThan(0)
  })

  it('emits Organization + WebSite JSON-LD', async () => {
    const { head } = await render('/')
    const types = head.jsonLd.map((d) => d['@type'])
    expect(types).toContain('Organization')
    expect(types).toContain('WebSite')
  })

  it('every JSON-LD doc has a schema.org @context', async () => {
    const { head } = await render('/')
    for (const doc of head.jsonLd) {
      expect(doc['@context']).toBe('https://schema.org')
    }
  })
})

describe('SSR render — privacy', () => {
  it('renders the privacy policy body', async () => {
    const { html, head } = await render('/privacy')
    expect(html).toMatch(/privacy/i)
    expect(head.title).toMatch(/privacy/i)
    expect(head.jsonLd.length).toBeGreaterThan(0)
    expect(head.jsonLd[0]['@type']).toBe('WebPage')
  })
})

describe('SSR render — data-quality', () => {
  it('advertises the knowledge graph as a schema.org Dataset', async () => {
    const { head } = await render('/data-quality')
    expect(head.jsonLd[0]['@type']).toBe('Dataset')
    expect(head.jsonLd[0].license).toBeTruthy()
  })
})

describe('SSR render — unknown routes', () => {
  it('returns 404 view content without crashing', async () => {
    const { html } = await render('/this-route-does-not-exist')
    // NotFoundView renders "Page not found" or similar
    expect(html.length).toBeGreaterThan(0)
  })
})

describe('SSR head canonical + og:image', () => {
  it('falls back to CANONICAL_URL / www.fontem.eu when host is absent', async () => {
    const { head } = await render('/')
    // No requestHost in context → fallback. www.fontem.eu is what's
    // actually wired today; fontem.eu apex is planned.
    expect(head.canonical).toBe('https://www.fontem.eu/')
    expect(head.ogImage).toBe('https://www.fontem.eu/og-card.png')
  })

  it('uses the request host when supplied (dynamic per request)', async () => {
    const { head } = await render('/privacy', {
      requestHost: 'gmr.void42.net',
      requestProto: 'https',
    })
    expect(head.canonical).toBe('https://gmr.void42.net/privacy')
    expect(head.ogImage).toBe('https://gmr.void42.net/og-card.png')
  })
})
