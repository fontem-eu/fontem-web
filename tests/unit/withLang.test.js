import { _internal } from '../../src/api/session.js'
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('withLang', () => {
  beforeEach(() => {
    _internal.clearForTests(); localStorage.clear()
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

// ── Mutation-hardening: explicit-override and separator edges ──────
describe('withLang override edges', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear(); vi.resetModules() })

  async function fresh(lang) {
    localStorage.setItem('gmr-lang', lang)
    const { useLang } = await import('../../src/composables/useLang.js')
    useLang().init()
    const { withLang } = await import('../../src/api/_lang.js')
    return withLang
  }

  it('leaves a path alone when lang is already present', async () => {
    const withLang = await fresh('de')
    expect(withLang('/api/x?lang=fr')).toBe('/api/x?lang=fr')
    expect(withLang('/api/x?a=1&lang=fr')).toBe('/api/x?a=1&lang=fr')
  })

  it('does not mistake a suffixed param for lang', async () => {
    const withLang = await fresh('de')
    expect(withLang('/api/x?apilang=fr')).toBe('/api/x?apilang=fr&lang=de')
  })
})
