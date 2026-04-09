import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('useAnalytics', () => {
  let useAnalytics
  const mockFetch = vi.fn().mockResolvedValue({})

  beforeEach(async () => {
    vi.resetModules()
    vi.stubGlobal('fetch', mockFetch)
    // Default: no website ID set
    delete window.UMAMI_WEBSITE_ID
    const mod = await import('../../src/composables/useAnalytics.js')
    useAnalytics = mod.useAnalytics
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({})
    delete window.UMAMI_WEBSITE_ID
  })

  it('_send is a no-op when UMAMI_WEBSITE_ID is not set', () => {
    const { page } = useAnalytics()
    page()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('_send is a no-op when UMAMI_WEBSITE_ID is the placeholder', () => {
    window.UMAMI_WEBSITE_ID = 'REPLACE_WITH_WEBSITE_ID'
    const { page } = useAnalytics()
    page()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('_send calls fetch when UMAMI_WEBSITE_ID is set to a real value', () => {
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

  it('page() sends type "event" with url in payload', () => {
    window.UMAMI_WEBSITE_ID = 'abc-123'
    const { page } = useAnalytics()
    page('/test-page')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.type).toBe('event')
    expect(body.payload.url).toBe('/test-page')
    expect(body.payload.website).toBe('abc-123')
  })

  it('track(name, data) sends name and data in payload', () => {
    window.UMAMI_WEBSITE_ID = 'abc-123'
    const { track } = useAnalytics()
    track('btn-click', { button: 'submit' })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.type).toBe('event')
    expect(body.payload.name).toBe('btn-click')
    expect(body.payload.data).toEqual({ button: 'submit' })
  })

  it('fetch failure does not throw (fire-and-forget)', () => {
    window.UMAMI_WEBSITE_ID = 'abc-123'
    mockFetch.mockRejectedValue(new Error('network down'))
    const { page } = useAnalytics()
    // Should not throw
    expect(() => page()).not.toThrow()
  })

  it('_send is a no-op when UMAMI_WEBSITE_ID is null', () => {
    window.UMAMI_WEBSITE_ID = null
    const { track } = useAnalytics()
    track('event')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('_send is a no-op when UMAMI_WEBSITE_ID is empty string', () => {
    window.UMAMI_WEBSITE_ID = ''
    const { track } = useAnalytics()
    track('event')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('payload includes hostname from window.location', () => {
    window.UMAMI_WEBSITE_ID = 'abc-123'
    const { page } = useAnalytics()
    page()
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.payload).toHaveProperty('hostname')
    expect(typeof body.payload.hostname).toBe('string')
  })

  it('payload includes language from navigator', () => {
    window.UMAMI_WEBSITE_ID = 'abc-123'
    const { page } = useAnalytics()
    page()
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.payload).toHaveProperty('language')
    expect(typeof body.payload.language).toBe('string')
  })

  it('payload includes screen dimensions', () => {
    window.UMAMI_WEBSITE_ID = 'abc-123'
    const { page } = useAnalytics()
    page()
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.payload).toHaveProperty('screen')
    expect(typeof body.payload.screen).toBe('string')
  })

  it('page() without arg uses current pathname as url', () => {
    window.UMAMI_WEBSITE_ID = 'abc-123'
    const { page } = useAnalytics()
    page()
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.payload.url).toBe(window.location.pathname)
  })

  it('track() includes base payload fields', () => {
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

  it('body is JSON stringified with type "event"', () => {
    window.UMAMI_WEBSITE_ID = 'abc-123'
    const { track } = useAnalytics()
    track('x')
    const raw = mockFetch.mock.calls[0][1].body
    const parsed = JSON.parse(raw)
    expect(parsed).toHaveProperty('type', 'event')
    expect(parsed).toHaveProperty('payload')
  })

  it('placeholder string "REPLACE_WITH_WEBSITE_ID" is exact match', () => {
    window.UMAMI_WEBSITE_ID = 'REPLACE_WITH_WEBSITE_ID_extra'
    const { page } = useAnalytics()
    page()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
