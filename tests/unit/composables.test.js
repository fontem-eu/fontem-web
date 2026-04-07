import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('useAnalytics', () => {
  let analytics

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })))
    // Reset module cache to get fresh state
    const mod = await import('../../src/composables/useAnalytics.js')
    analytics = mod.useAnalytics()
  })
  afterEach(() => vi.restoreAllMocks())

  it('exports page and track functions', () => {
    expect(typeof analytics.page).toBe('function')
    expect(typeof analytics.track).toBe('function')
  })

  it('page() does not throw without Umami configured', () => {
    expect(() => analytics.page('/test')).not.toThrow()
  })

  it('track() does not throw without Umami configured', () => {
    expect(() => analytics.track('click', { button: 'save' })).not.toThrow()
  })
})

describe('format utilities', () => {
  let format

  beforeEach(async () => {
    format = await import('../../src/utils/format.js')
  })

  it('fmtMoney formats large numbers with $ by default', () => {
    expect(format.fmtMoney(1234567890)).toContain('$')
    expect(format.fmtMoney(1234567890)).toContain('1')
  })

  it('fmtEur formats with € symbol', () => {
    expect(format.fmtEur(5000000)).toBe('€5.0M')
  })

  it('fmtMoney handles null/undefined', () => {
    expect(format.fmtMoney(null)).toBe('—')
    expect(format.fmtMoney(undefined)).toBe('—')
  })

  it('fmtPrice formats to 2 decimals', () => {
    const result = format.fmtPrice(123.456)
    expect(result).toContain('123.4')
  })

  it('fmtPrice handles null', () => {
    expect(format.fmtPrice(null)).toBe('—')
  })
})
