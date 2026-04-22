import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('withLang', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  async function fresh(lang) {
    if (lang) localStorage.setItem('gmr-lang', lang)
    const { useLang } = await import('../../src/composables/useLang.js')
    useLang().init()
    const { withLang } = await import('../../src/api/_lang.js')
    return withLang
  }

  it('appends lang to a path with no query', async () => {
    const withLang = await fresh('de')
    expect(withLang('/capi/reports')).toBe('/capi/reports?lang=de')
  })

  it('appends lang to a path that already has a query', async () => {
    const withLang = await fresh('fr')
    expect(withLang('/capi/reports?limit=10')).toBe('/capi/reports?limit=10&lang=fr')
  })

  it('does not duplicate lang when caller sets it explicitly', async () => {
    const withLang = await fresh('fr')
    expect(withLang('/api/x?lang=it&foo=1')).toBe('/api/x?lang=it&foo=1')
  })

  it('handles URL-encoded values in existing query', async () => {
    const withLang = await fresh('pl')
    const url = '/api/search?q=' + encodeURIComponent('état')
    expect(withLang(url)).toBe(url + '&lang=pl')
  })

  it('defaults to en when nothing is set', async () => {
    const withLang = await fresh(null)
    expect(withLang('/api/authorities/x')).toBe('/api/authorities/x?lang=en')
  })
})
