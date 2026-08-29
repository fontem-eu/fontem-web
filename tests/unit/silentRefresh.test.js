/**
 * Tests for the silent-refresh flow in the API client.
 *
 * Contract: a 401 on a token-bearing request triggers exactly one
 * `/auth/refresh` round trip and then replays the original request
 * with the fresh access token. Anonymous calls that 401 don't try
 * to refresh (they're 401-because-not-logged-in, not session-expired).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Pin the real community.js — see communityApi.test.js for why.
vi.unmock('../../src/api/community.js')

import { _internal } from '../../src/api/session.js'
import { getReport } from '../../src/api/community.js'

describe('community.js silent refresh', () => {
  beforeEach(() => {
    _internal.clearForTests()
    localStorage.clear()
    vi.restoreAllMocks()
  })
  afterEach(() => {
    _internal.clearForTests()
    localStorage.clear()
  })

  it('401 on a token-bearing request triggers /auth/refresh + replay', async () => {
    _internal.setAccessToken('stale.jwt')
    const calls = []
    const fetchMock = vi.fn().mockImplementation(async (url, opts) => {
      calls.push({ url, headers: opts?.headers })
      // First call: /capi/data-stories/abc with stale token → 401
      if (url.startsWith('/capi/data-stories/') && opts.headers.Authorization === 'Bearer stale.jwt') {
        return { ok: false, status: 401, text: async () => '', json: async () => ({}) }
      }
      // Refresh: server hands us a fresh token
      if (url === '/capi/auth/refresh') {
        return {
          ok: true,
          json: async () => ({ access_token: 'fresh.jwt', user: { id: 'u1' } }),
        }
      }
      // Replay: same URL but with the new token
      if (url.startsWith('/capi/data-stories/') && opts.headers.Authorization === 'Bearer fresh.jwt') {
        return { ok: true, status: 200, json: async () => ({ id: 'abc', title: 'OK' }) }
      }
      throw new Error(`unmatched mock: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const data = await getReport('abc')
    expect(data.title).toBe('OK')
    // Exactly three calls: the initial 401, the refresh, the replay.
    expect(calls.length).toBe(3)
    expect(calls[0].headers.Authorization).toBe('Bearer stale.jwt')
    expect(calls[1].url).toBe('/capi/auth/refresh')
    expect(calls[2].headers.Authorization).toBe('Bearer fresh.jwt')
  })

  it('does NOT refresh when an anonymous request gets 401', async () => {
    // No token set — it's an anonymous call.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 401, text: async () => '', json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(getReport('abc')).rejects.toThrow(/401/)
    // Just one call — no refresh attempt.
    expect(fetchMock.mock.calls.length).toBe(1)
  })

  it('does not loop when the refresh itself fails', async () => {
    _internal.setAccessToken('stale.jwt')
    let originalCalls = 0
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      if (url.startsWith('/capi/data-stories/')) {
        originalCalls++
        return { ok: false, status: 401, text: async () => '', json: async () => ({}) }
      }
      if (url === '/capi/auth/refresh') {
        return { ok: false, status: 401, json: async () => ({}) }
      }
      throw new Error(`unmatched mock: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    // Stub the redirect so the test environment doesn't blow up.
    const origLocation = globalThis.location
    delete globalThis.location
    globalThis.location = { href: '' }
    try {
      await expect(getReport('abc')).rejects.toThrow(/Session expired/)
      // Initial 401 attempt — exactly one. No replay because refresh
      // failed; the user gets bounced to /login instead.
      expect(originalCalls).toBe(1)
    } finally {
      globalThis.location = origLocation
    }
  })
})

describe('community.js cold-boot session-ready gate', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear(); vi.restoreAllMocks() })
  afterEach(() => { _internal.clearForTests(); localStorage.clear() })

  it('first request waits for the cold-boot restore so it does not go out anonymous', async () => {
    // Simulate: restoreSession() is in flight (cookie→token refresh)
    // when a view fires a data fetch. The request must NOT send before
    // the token lands, or a private resource would 404.
    const { restoreSession } = await import('../../src/api/session.js')
    const { getReport } = await import('../../src/api/community.js')

    let resolveRefresh
    const order = []
    const fetchMock = vi.fn(async (url) => {
      if (url === '/capi/auth/refresh') {
        order.push('refresh')
        return new Promise((res) => { resolveRefresh = () => {
          res({ ok: true, json: async () => ({ access_token: 'fresh.jwt', user: { id: 'u1' } }) })
        } })
      }
      // The data request — assert the token is already in place.
      order.push('data:' + (url.includes('Authorization') ? 'authed' : 'sent'))
      return { ok: true, status: 200, json: async () => ({ id: 'abc' }), text: async () => '' }
    })
    vi.stubGlobal('fetch', fetchMock)

    restoreSession()                 // cold-boot restore kicks off (pending)
    const reqPromise = getReport('abc')  // view fires a fetch immediately
    // Let microtasks flush — the data request must be blocked on the refresh.
    await Promise.resolve()
    expect(order).toEqual(['refresh'])   // only refresh has gone out so far
    resolveRefresh()                  // cookie→token resolves
    await reqPromise
    // Now the data request went out, AFTER refresh, carrying the token.
    const dataCall = fetchMock.mock.calls.find(([u]) => u.startsWith('/capi/data-stories'))
    expect(dataCall[1].headers.Authorization).toBe('Bearer fresh.jwt')
  })
})

// ── Mutation-hardening: the GET-only transient-retry boundary ──────
describe('community.js 5xx retry policy', () => {
  beforeEach(() => {
    _internal.clearForTests()
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    _internal.clearForTests()
    localStorage.clear()
  })

  const failing = (status) => vi.fn().mockResolvedValue({
    ok: false, status, text: async () => 'boom', json: async () => ({}),
  })

  it('retries a GET on 500 exactly twice, then surfaces the error', async () => {
    const fetchMock = failing(500)
    vi.stubGlobal('fetch', fetchMock)
    const p = getReport('r1').catch((e) => e)
    await vi.runAllTimersAsync()
    const err = await p
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(500)
    expect(fetchMock).toHaveBeenCalledTimes(3) // original + 2 retries
  })

  it('does not retry non-GET requests on 5xx', async () => {
    const fetchMock = failing(500)
    vi.stubGlobal('fetch', fetchMock)
    const { createReport } = await import('../../src/api/community.js')
    const p = createReport('t', 'a').catch((e) => e)
    await vi.runAllTimersAsync()
    const err = await p
    expect(err.status).toBe(500)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry 4xx (including 429 — deliberately)', async () => {
    const fetchMock = failing(429)
    vi.stubGlobal('fetch', fetchMock)
    const p = getReport('r1').catch((e) => e)
    await vi.runAllTimersAsync()
    const err = await p
    expect(err.status).toBe(429)
    expect(err.method).toBe('GET')
    expect(err.path).toBe('/data-stories/r1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a retry that succeeds returns the payload', async () => {
    let n = 0
    const fetchMock = vi.fn().mockImplementation(async () => {
      n += 1
      if (n === 1) return { ok: false, status: 503, text: async () => '' }
      return { ok: true, status: 200, json: async () => ({ id: 'r1' }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const p = getReport('r1')
    await vi.runAllTimersAsync()
    await expect(p).resolves.toEqual({ id: 'r1' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
