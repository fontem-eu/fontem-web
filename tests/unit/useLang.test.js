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
    localStorage.clear()
    document.documentElement.lang = ''
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'language', { value: originalLang, configurable: true })
    localStorage.clear()
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
