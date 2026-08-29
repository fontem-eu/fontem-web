import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('useAnalytics', () => {
  let useAnalytics
  const mockFetch = vi.fn().mockResolvedValue({})

  beforeEach(async () => {
    vi.resetModules()
    vi.stubGlobal('fetch', mockFetch)
    // Default: no website ID set, consent granted (so consent is not the
    // default reason for no-ops in most tests)
    delete window.UMAMI_WEBSITE_ID
    localStorage.setItem('gmr-cookie-consent', 'accepted')
    const mod = await import('../../src/composables/useAnalytics.js')
    useAnalytics = mod.useAnalytics
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({})
    delete window.UMAMI_WEBSITE_ID
    localStorage.removeItem('gmr-cookie-consent')
  })

  it('does not send events when UMAMI_WEBSITE_ID is not set', () => {
    const { page } = useAnalytics()
    page()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not send events when UMAMI_WEBSITE_ID is the placeholder', () => {
    window.UMAMI_WEBSITE_ID = 'REPLACE_WITH_WEBSITE_ID'
    const { page } = useAnalytics()
    page()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not send events when UMAMI_WEBSITE_ID is null', () => {
    window.UMAMI_WEBSITE_ID = null
    const { track } = useAnalytics()
    track('event')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not send events when UMAMI_WEBSITE_ID is empty string', () => {
    window.UMAMI_WEBSITE_ID = ''
    const { track } = useAnalytics()
    track('event')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sends events when UMAMI_WEBSITE_ID is a real value', () => {
    window.UMAMI_WEBSITE_ID = 'abc-123'
    const { page } = useAnalytics()
    page()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('/umami/api/send')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(opts.keepalive).toBe(true)
  })

  it('page() sends the given URL in the payload', () => {
    window.UMAMI_WEBSITE_ID = 'abc-123'
    const { page } = useAnalytics()
    page('/test-page')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.type).toBe('event')
    expect(body.payload.url).toBe('/test-page')
    expect(body.payload.website).toBe('abc-123')
  })

  it('page() without arg uses current pathname as url', () => {
    window.UMAMI_WEBSITE_ID = 'abc-123'
    const { page } = useAnalytics()
    page()
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.payload.url).toBe(window.location.pathname)
  })

  it('track() sends event name and custom data', () => {
    window.UMAMI_WEBSITE_ID = 'abc-123'
    const { track } = useAnalytics()
    track('btn-click', { button: 'submit' })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.type).toBe('event')
    expect(body.payload.name).toBe('btn-click')
    expect(body.payload.data).toEqual({ button: 'submit' })
  })

  it('track() includes context fields in payload', () => {
    window.UMAMI_WEBSITE_ID = 'abc-123'
    const { track } = useAnalytics()
    track('ev', { k: 'v' })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.payload.website).toBe('abc-123')
    expect(body.payload).toHaveProperty('hostname')
    expect(body.payload).toHaveProperty('url')
    expect(body.payload).toHaveProperty('language')
    expect(body.payload).toHaveProperty('screen')
  })

  it('never throws even when the network request fails', () => {
    window.UMAMI_WEBSITE_ID = 'abc-123'
    mockFetch.mockRejectedValue(new Error('network down'))
    const { page } = useAnalytics()
    expect(() => page()).not.toThrow()
  })

  it('treats the placeholder as an exact match — similar strings send events', () => {
    window.UMAMI_WEBSITE_ID = 'REPLACE_WITH_WEBSITE_ID_extra'
    const { page } = useAnalytics()
    page()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does not send events when consent has not been given', () => {
    localStorage.removeItem('gmr-cookie-consent')
    window.UMAMI_WEBSITE_ID = 'abc-123'
    const { page } = useAnalytics()
    page()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not send events when consent is declined', () => {
    localStorage.setItem('gmr-cookie-consent', 'declined')
    window.UMAMI_WEBSITE_ID = 'abc-123'
    const { track } = useAnalytics()
    track('event')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ── Mutation-hardening: exact payload + endpoint + consent key ─────
describe('useAnalytics payload contract', () => {
  const mockFetch = vi.fn().mockResolvedValue({})
  let useAnalytics

  beforeEach(async () => {
    vi.resetModules()
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockClear()
    mockFetch.mockResolvedValue({})
    window.UMAMI_WEBSITE_ID = 'site-1'
    localStorage.setItem('gmr-cookie-consent', 'accepted')
    const mod = await import('../../src/composables/useAnalytics.js')
    useAnalytics = mod.useAnalytics
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete window.UMAMI_WEBSITE_ID
    localStorage.removeItem('gmr-cookie-consent')
  })

  it('POSTs the umami event envelope with the environment snapshot', () => {
    useAnalytics().track('search', { q: 'x' })
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('/umami/api/send')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init.keepalive).toBe(true)
    const body = JSON.parse(init.body)
    expect(body.type).toBe('event')
    expect(body.payload.website).toBe('site-1')
    expect(body.payload.name).toBe('search')
    expect(body.payload.data).toEqual({ q: 'x' })
    expect(body.payload.url).toBe(globalThis.location.pathname)
    expect(body.payload.hostname).toBe(globalThis.location.hostname)
    expect(body.payload.language).toBe(navigator.language)
    expect(body.payload.screen).toBe(`${screen.width}x${screen.height}`)
  })

  it('page() uses the explicit URL when given, else the current path', () => {
    useAnalytics().page('/somewhere')
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).payload.url).toBe('/somewhere')
    useAnalytics().page()
    expect(JSON.parse(mockFetch.mock.calls[1][1].body).payload.url).toBe(globalThis.location.pathname)
  })

  it('stays silent without consent or with the placeholder id', () => {
    localStorage.setItem('gmr-cookie-consent', 'declined')
    useAnalytics().track('x')
    expect(mockFetch).not.toHaveBeenCalled()
    localStorage.setItem('gmr-cookie-consent', 'accepted')
    window.UMAMI_WEBSITE_ID = 'REPLACE_WITH_WEBSITE_ID'
    useAnalytics().track('x')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
