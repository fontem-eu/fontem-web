/**
 * Per-story meta and Article JSON-LD.
 *
 * Every story used to serve the homepage's title, description and
 * JSON-LD, because nothing rendered them server-side. These cover the
 * two halves of the replacement: the meta built from a prefetched story,
 * and the Article document that makes it quotable.
 */
import { describe, it, expect } from 'vitest'
import { titleForPath, descriptionForPath } from '../../src/ssr/meta.js'
import { buildJsonLd } from '../../src/ssr/jsonLd.js'

const ROUTE = { path: '/stories/abc', matched: [{ path: '/stories/:id' }] }
const STORY = {
  id: 'abc',
  title: 'Why recorded rape doubled in Europe',
  abstract: 'Seven EU countries adopted consent-based rape laws between 2016 and 2023.',
  created_at: '2026-07-30T00:00:00Z',
  updated_at: '2026-08-02T00:00:00Z',
  author_name: 'A Reporter',
  sources: ['https://ted.europa.eu/notice/1', { url: 'https://eur-lex.europa.eu/x' }],
}

describe('story meta', () => {
  it('titles the page after the story, not the site', () => {
    const title = titleForPath(ROUTE, { story: STORY })
    expect(title).toContain('Why recorded rape doubled in Europe')
    expect(title).not.toBe(titleForPath({ path: '/' }))
  })

  it('describes the page with the story abstract', () => {
    expect(descriptionForPath(ROUTE, { story: STORY })).toContain('consent-based rape laws')
  })

  it('keeps both inside what a search result renders', () => {
    const long = {
      ...STORY,
      title: 'A headline that runs on well past the sixty characters a result will show',
      abstract: 'x'.repeat(400),
    }
    expect(titleForPath(ROUTE, { story: long }).length).toBeLessThanOrEqual(60)
    expect(descriptionForPath(ROUTE, { story: long }).length).toBeLessThanOrEqual(160)
  })

  it('clamps on a word boundary rather than mid-word', () => {
    const long = { ...STORY, abstract: 'alpha bravo charlie delta echo foxtrot '.repeat(20) }
    const desc = descriptionForPath(ROUTE, { story: long })
    // Ends with the ellipsis, and the character before it is not a
    // half-written word left dangling by a hard slice.
    expect(desc.endsWith('…')).toBe(true)
    expect(desc.slice(0, -1)).not.toMatch(/\s$/)
  })

  it('falls back to the static map when no story was prefetched', () => {
    expect(titleForPath({ path: '/about' })).toBe('About — Fontem')
    expect(titleForPath(ROUTE, {})).toBe(titleForPath({ path: '/nope' }))
  })

  it('uses site boilerplate only as a last resort, not over real prose', () => {
    const noAbstract = { ...STORY, abstract: '   ' }
    const generic = descriptionForPath({ path: '/nope' })
    expect(descriptionForPath(ROUTE, { story: noAbstract })).toBe(generic)
  })
})

describe('story JSON-LD', () => {
  it('emits one Article naming the story and its canonical URL', () => {
    const [doc, ...rest] = buildJsonLd(ROUTE, { story: STORY })
    expect(rest).toHaveLength(0)
    expect(doc['@type']).toBe('Article')
    expect(doc.headline).toBe(STORY.title)
    expect(doc.url).toMatch(/\/stories\/abc$/)
    expect(doc.mainEntityOfPage).toBe(doc.url)
    expect(doc.datePublished).toBe(STORY.created_at)
    expect(doc.dateModified).toBe(STORY.updated_at)
    expect(doc.author).toEqual({ '@type': 'Person', name: 'A Reporter' })
    expect(doc.isAccessibleForFree).toBe(true)
  })

  it('carries the primary sources as citations', () => {
    const [doc] = buildJsonLd(ROUTE, { story: STORY })
    // Both shapes the API uses — a bare URL and an object with one.
    expect(doc.citation).toEqual([
      'https://ted.europa.eu/notice/1',
      'https://eur-lex.europa.eu/x',
    ])
  })

  it('emits nothing rather than inventing a document from the URL', () => {
    expect(buildJsonLd(ROUTE, {})).toEqual([])
    expect(buildJsonLd(ROUTE, { story: { title: 'no id' } })).toEqual([])
  })

  it('omits fields the story does not have instead of emitting nulls', () => {
    const [doc] = buildJsonLd(ROUTE, { story: { id: 'x', title: 'T' } })
    for (const k of ['description', 'datePublished', 'dateModified', 'author', 'citation']) {
      expect(doc).not.toHaveProperty(k)
    }
  })

  it('still answers for the static routes it always did', () => {
    expect(buildJsonLd({ path: '/' }, {}).map((d) => d['@type']))
      .toEqual(['Organization', 'WebSite', 'ItemList'])
    expect(buildJsonLd({ path: '/nope' }, {})).toEqual([])
  })
})
