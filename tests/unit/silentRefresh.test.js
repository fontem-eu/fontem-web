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
