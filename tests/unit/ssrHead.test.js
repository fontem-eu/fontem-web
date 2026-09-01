/**
 * The <head> serialiser, and specifically the canonical rule.
 *
 * nginx serves ONE static shell for every client-routed URL — every
 * story, every company, every contract. It used to fall back to
 * index.html, which is the prerendered homepage, so all of those pages
 * shipped the homepage's canonical. A canonical naming a different URL
 * is not a weak hint: it tells Google this page IS that one, so none of
 * them get indexed — while sitemap-stories.xml submitted them.
 *
 * Hence the shell renders with `{ canonical: false }`, and that has to
 * stay true.
 */
import { describe, it, expect } from 'vitest'
import { renderHead, escapeHtml } from '../../src/ssr/head.js'

const HEAD = {
  title: 'Story — Fontem',
  description: 'A description.',
  canonical: 'https://fontem.eu/stories/abc',
  ogImage: 'https://fontem.eu/og-card.png',
  jsonLd: [{ '@type': 'ItemList', name: 'feed' }],
}

describe('renderHead', () => {
  it('emits the canonical and og:url for a real page', () => {
    const html = renderHead(HEAD)
    expect(html).toContain('<link rel="canonical" href="https://fontem.eu/stories/abc"/>')
    expect(html).toContain('<meta property="og:url" content="https://fontem.eu/stories/abc"/>')
  })

  it('omits both when canonical is off, keeping everything else', () => {
    const html = renderHead(HEAD, { canonical: false })
    expect(html).not.toContain('rel="canonical"')
    expect(html).not.toContain('og:url')
    // The shell still needs a title, a description and a card image.
    expect(html).toContain('<title>Story — Fontem</title>')
    expect(html).toContain('name="description"')
    expect(html).toContain('og:image')
  })

  it('carries title and description into the og and twitter pairs', () => {
    const html = renderHead({ title: 'T', description: 'D' })
    for (const tag of ['og:title', 'twitter:title']) expect(html).toContain(tag)
    for (const tag of ['og:description', 'twitter:description']) expect(html).toContain(tag)
  })

  it('serialises each JSON-LD document into its own script tag', () => {
    const html = renderHead({ jsonLd: [{ '@type': 'A' }, { '@type': 'B' }] })
    expect((html.match(/application\/ld\+json/g) || []).length).toBe(2)
    expect(html).toContain('{"@type":"A"}')
  })

  it('emits nothing for an empty head rather than empty tags', () => {
    expect(renderHead({})).toBe('')
  })

  it('escapes values so a quote in a title cannot break out of the attribute', () => {
    const html = renderHead({ title: 'A "quoted" <b>title</b> & more' })
    expect(html).toContain('&quot;quoted&quot;')
    expect(html).toContain('&lt;b&gt;')
    expect(html).toContain('&amp;')
    // The attribute must not be terminated early by the raw quote.
    expect(html).not.toMatch(/content="A "/)
  })

  it('escapeHtml covers the five XML-significant characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})
