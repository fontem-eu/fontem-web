import { _internal } from '../../src/api/session.js'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { normaliseLang, EU_CODES, DEFAULT_LANG } from '../../src/composables/eu-languages.js'

describe('normaliseLang', () => {
  it('accepts every EU-24 code', () => {
    for (const c of EU_CODES) expect(normaliseLang(c)).toBe(c)
  })

  it('normalises case + region suffix', () => {
    expect(normaliseLang('FR')).toBe('fr')
    expect(normaliseLang('pt-BR')).toBe('pt')
    expect(normaliseLang('en_GB')).toBe('en')
    expect(normaliseLang('  de  ')).toBe('de')
  })

  it('rejects non-EU + garbage', () => {
    expect(normaliseLang('ja')).toBeNull()
    expect(normaliseLang('zh-CN')).toBeNull()
    expect(normaliseLang('')).toBeNull()
    expect(normaliseLang(undefined)).toBeNull()
    expect(normaliseLang(null)).toBeNull()
    expect(normaliseLang('x')).toBeNull()
    expect(normaliseLang('<script>')).toBeNull()
  })
})

describe('useLang', () => {
  const originalLang = typeof navigator !== 'undefined' ? navigator.language : ''

  beforeEach(() => {
    _internal.clearForTests(); localStorage.clear()
    document.documentElement.lang = ''
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'language', { value: originalLang, configurable: true })
    _internal.clearForTests(); localStorage.clear()
    vi.restoreAllMocks()
    // Reset the singleton between tests
    vi.resetModules()
  })

  it('init() picks up a stored preference first', async () => {
    localStorage.setItem('gmr-lang', 'de')
    vi.resetModules()
    const { useLang } = await import('../../src/composables/useLang.js')
    const { init, lang } = useLang()
    init()
    expect(lang.value).toBe('de')
    expect(document.documentElement.lang).toBe('de')
  })

  it('init() falls back to navigator.language when nothing stored', async () => {
    Object.defineProperty(navigator, 'language', { value: 'pl-PL', configurable: true })
    vi.resetModules()
    const { useLang } = await import('../../src/composables/useLang.js')
    const { init, lang } = useLang()
    init()
    expect(lang.value).toBe('pl')
  })

  it('init() falls back to default for non-EU browser language', async () => {
    Object.defineProperty(navigator, 'language', { value: 'ja-JP', configurable: true })
    vi.resetModules()
    const { useLang } = await import('../../src/composables/useLang.js')
    const { init, lang } = useLang()
    init()
    expect(lang.value).toBe(DEFAULT_LANG)
  })

  it('setLang() persists + updates <html lang>', async () => {
    vi.resetModules()
    const { useLang } = await import('../../src/composables/useLang.js')
    const { setLang, lang } = useLang()
    setLang('fr')
    expect(lang.value).toBe('fr')
    expect(localStorage.getItem('gmr-lang')).toBe('fr')
    expect(document.documentElement.lang).toBe('fr')
  })

  it('setLang() silently ignores invalid codes', async () => {
    vi.resetModules()
    const { useLang } = await import('../../src/composables/useLang.js')
    const { setLang, lang, init } = useLang()
    init()
    const before = lang.value
    setLang('xx')
    setLang('')
    setLang(null)
    expect(lang.value).toBe(before)
  })

  it('currentLang() reflects the live value for API calls', async () => {
    vi.resetModules()
    const { useLang, currentLang } = await import('../../src/composables/useLang.js')
    const { setLang } = useLang()
    setLang('it')
    expect(currentLang()).toBe('it')
  })
})

describe('useLang — IP-geo detection', () => {
  beforeEach(() => {
    _internal.clearForTests(); localStorage.clear(); sessionStorage.clear()
    document.documentElement.lang = ''
  })
  afterEach(() => {
    _internal.clearForTests(); localStorage.clear(); sessionStorage.clear()
    vi.restoreAllMocks(); vi.resetModules()
  })

  const geoFetch = (lang) => vi.fn(async (url) => {
    expect(String(url)).toContain('/api/geo/client-language')
    return { ok: true, json: async () => ({ country: 'FR', lang }) }
  })

  it('with nothing stored, the IP-country hint overrides the browser language', async () => {
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true })
    vi.stubGlobal('fetch', geoFetch('fr'))
    vi.resetModules()
    const { useLang } = await import('../../src/composables/useLang.js')
    const { init, lang } = useLang()
    init()
    expect(lang.value).toBe('en') // provisional paint from the browser
    await vi.waitFor(() => expect(lang.value).toBe('fr')) // geo wins
    // detection is NOT persisted — only explicit picks are
    expect(localStorage.getItem('gmr-lang')).toBeNull()
    expect(sessionStorage.getItem('gmr-geo-lang')).toBe('fr')
  })

  it('a stored explicit choice beats the IP hint (no lookup needed)', async () => {
    localStorage.setItem('gmr-lang', 'de')
    const f = geoFetch('fr'); vi.stubGlobal('fetch', f)
    vi.resetModules()
    const { useLang } = await import('../../src/composables/useLang.js')
    const { init, lang } = useLang()
    init()
    await new Promise((r) => setTimeout(r, 20))
    expect(lang.value).toBe('de')
    expect(f).not.toHaveBeenCalled()
  })

  it('geo failure or null hint leaves the browser fallback in place', async () => {
    Object.defineProperty(navigator, 'language', { value: 'pl-PL', configurable: true })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ country: 'JP', lang: null }) })))
    vi.resetModules()
    const { useLang } = await import('../../src/composables/useLang.js')
    const { init, lang } = useLang()
    init()
    await new Promise((r) => setTimeout(r, 20))
    expect(lang.value).toBe('pl')
  })

  it('an explicit pick made while the lookup is in flight wins', async () => {
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true })
    let resolveFetch
    vi.stubGlobal('fetch', vi.fn(() => new Promise((r) => { resolveFetch = r })))
    vi.resetModules()
    const { useLang } = await import('../../src/composables/useLang.js')
    const { init, setLang, lang } = useLang()
    init()
    setLang('pt') // user clicks the picker before the geo response lands
    resolveFetch({ ok: true, json: async () => ({ country: 'FR', lang: 'fr' }) })
    await new Promise((r) => setTimeout(r, 20))
    expect(lang.value).toBe('pt') // geo did not clobber the explicit pick
    expect(localStorage.getItem('gmr-lang')).toBe('pt')
  })

  it('caches the hint per session (second init does not refetch)', async () => {
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true })
    sessionStorage.setItem('gmr-geo-lang', 'fr')
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    vi.resetModules()
    const { useLang } = await import('../../src/composables/useLang.js')
    const { init, lang } = useLang()
    init()
    await vi.waitFor(() => expect(lang.value).toBe('fr'))
    expect(f).not.toHaveBeenCalled()
  })
})

// ── Mutation-hardening: the EU-24 catalogue is exact ───────────────
describe('EU_LANGUAGES catalogue', () => {
  it('pins every native-name label', async () => {
    const { EU_LANGUAGES } = await import('../../src/composables/eu-languages.js')
    expect(EU_LANGUAGES).toEqual([
      { code: 'bg', label: 'Български' },
      { code: 'cs', label: 'Čeština' },
      { code: 'da', label: 'Dansk' },
      { code: 'de', label: 'Deutsch' },
      { code: 'el', label: 'Ελληνικά' },
      { code: 'en', label: 'English' },
      { code: 'es', label: 'Español' },
      { code: 'et', label: 'Eesti' },
      { code: 'fi', label: 'Suomi' },
      { code: 'fr', label: 'Français' },
      { code: 'ga', label: 'Gaeilge' },
      { code: 'hr', label: 'Hrvatski' },
      { code: 'hu', label: 'Magyar' },
      { code: 'it', label: 'Italiano' },
      { code: 'lt', label: 'Lietuvių' },
      { code: 'lv', label: 'Latviešu' },
      { code: 'mt', label: 'Malti' },
      { code: 'nl', label: 'Nederlands' },
      { code: 'pl', label: 'Polski' },
      { code: 'pt', label: 'Português' },
      { code: 'ro', label: 'Română' },
      { code: 'sk', label: 'Slovenčina' },
      { code: 'sl', label: 'Slovenščina' },
      { code: 'sv', label: 'Svenska' },
    ])
  })

  it('normalises regioned and cased inputs, rejecting junk', async () => {
    const { normaliseLang } = await import('../../src/composables/eu-languages.js')
    expect(normaliseLang('EN')).toBe('en')
    expect(normaliseLang('fr-FR')).toBe('fr')
    expect(normaliseLang('pt_BR')).toBe('pt')
    expect(normaliseLang(' de ')).toBe('de')
    expect(normaliseLang('xx')).toBeNull()
    expect(normaliseLang('')).toBeNull()
    expect(normaliseLang(null)).toBeNull()
    expect(normaliseLang(42)).toBeNull()
  })
})
