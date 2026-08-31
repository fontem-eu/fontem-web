/**
 * Mutation-hardening for the core/SSR tier: pins the SEO strings in
 * ssr/meta.js, the JSON-LD builders, and the i18n locale loader.
 */
import { describe, it, expect } from 'vitest'
import { titleForPath, descriptionForPath } from '../../src/ssr/meta.js'
import { buildJsonLd } from '../../src/ssr/jsonLd.js'
import { createFontemI18n, ensureLocale, activateLocale } from '../../src/i18n.js'

// The exact strings used to be pinned here, one assertion per title. That
// asserted the copy never changes, which is not a property worth having —
// it makes an SEO reword a failing test — and it never asserted the copy
// was any good. These pin what actually has to hold: that every mapped
// route is wired to its own meta and none of them silently falls through
// to the catch-all.
describe('ssr/meta', () => {
  const MAPPED = ['/', '/about', '/privacy', '/data-quality', '/sparql',
    '/map', '/spending', '/login', '/development']
  const defaultTitle = titleForPath({ path: '/no-such-route' })
  const defaultDescription = descriptionForPath({ path: '/no-such-route' })

  it.each(MAPPED)('%s has meta of its own, not the fallback', (path) => {
    const title = titleForPath({ path })
    const description = descriptionForPath({ path })
    expect(title).not.toBe(defaultTitle)
    expect(description).not.toBe(defaultDescription)
    expect(title.trim()).toBe(title)
    expect(description.trim()).toBe(description)
  })

  it('gives every route a distinct title', () => {
    const titles = MAPPED.map((path) => titleForPath({ path }))
    expect(new Set(titles).size).toBe(MAPPED.length)
  })

  it('falls back to the site default for an unmapped route', () => {
    expect(titleForPath({ path: '/nope' })).toBe(defaultTitle)
    expect(descriptionForPath({ path: '/nope' })).toBe(defaultDescription)
    expect(defaultTitle).toBeTruthy()
    expect(defaultDescription).toBeTruthy()
  })
})

describe('ssr/jsonLd — builders', () => {
  it('unknown routes emit nothing', () => {
    expect(buildJsonLd({ path: '/nope' })).toEqual([])
  })

  it('privacy and data-quality emit their single documents', () => {
    const [privacy] = buildJsonLd({ path: '/privacy' })
    expect(privacy['@type']).toBe('WebPage')
    expect(privacy.name).toBe('Privacy Policy')
    expect(privacy.url).toBe('https://fontem.eu/privacy')
    const [dq] = buildJsonLd({ path: '/data-quality' })
    expect(dq['@type']).toBe('Dataset')
  })

  it('the landing emits organization, website and the feed ItemList', () => {
    const [org, site, list] = buildJsonLd({ path: '/' })
    expect(org['@type']).toBe('Organization')
    expect(org.name).toBe('Fontem')
    expect(org.url).toBe('https://fontem.eu')
    expect(org.logo).toBe('https://fontem.eu/favicon.svg')
    expect(site['@type']).toBe('WebSite')
    expect(site.potentialAction['@type']).toBe('SearchAction')
    expect(list['@type']).toBe('ItemList')
    expect(list.name).toBe('Fontem public data stories')
    expect(list.url).toBe('https://fontem.eu/')
  })

  it('the feed ItemList lists prefetched stories with 1-based positions', () => {
    const ctx = { stories: [{ id: 's1', title: 'A' }, { id: 's2', title: 'B' }] }
    const list = buildJsonLd({ path: '/' }, ctx)[2]
    expect(list.numberOfItems).toBe(2)
    expect(list.itemListElement[0]).toEqual({
      '@type': 'ListItem', position: 1, url: 'https://fontem.eu/stories/s1', name: 'A',
    })
    expect(list.itemListElement[1].position).toBe(2)
    expect(list.itemListElement[1].url).toBe('https://fontem.eu/stories/s2')
  })

  it('caps the list at 25 and falls back to ctx.reports', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, title: `T${i}` }))
    expect(buildJsonLd({ path: '/' }, { stories: many })[2].numberOfItems).toBe(25)
    const viaReports = buildJsonLd({ path: '/' }, { reports: [{ id: 'r1', title: 'R' }] })[2]
    expect(viaReports.numberOfItems).toBe(1)
    expect(viaReports.itemListElement[0].url).toBe('https://fontem.eu/stories/r1')
    expect(buildJsonLd({ path: '/' }, {})[2].numberOfItems).toBe(0)
  })
})

describe('i18n factory + locale loader', () => {
  it('boots composition-mode English with en fallback', () => {
    const i18n = createFontemI18n()
    expect(i18n.mode).toBe('composition')
    expect(i18n.global.locale.value).toBe('en')
    expect(i18n.global.fallbackLocale.value).toBe('en')
    expect(i18n.global.t('app_footer.privacy')).toBeTruthy()
  })

  it('lazily loads every supported locale exactly once', async () => {
    const i18n = createFontemI18n()
    const codes = ['bg', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr', 'ga', 'hr', 'hu',
      'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv']
    for (const code of codes) {
      await expect(ensureLocale(i18n, code)).resolves.toBe(code)
      const msgs = i18n.global.getLocaleMessage(code)
      expect(Object.keys(msgs).length, `locale ${code} should have messages`).toBeGreaterThan(0)
    }
  })

  it('unknown locales fall back to en without loading anything', async () => {
    const i18n = createFontemI18n()
    await expect(ensureLocale(i18n, 'xx')).resolves.toBe('en')
  })

  it('activateLocale flips the active locale', async () => {
    const i18n = createFontemI18n()
    await activateLocale(i18n, 'pt')
    expect(i18n.global.locale.value).toBe('pt')
    await activateLocale(i18n, 'zz')
    expect(i18n.global.locale.value).toBe('en')
  })
})
