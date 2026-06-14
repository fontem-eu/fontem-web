/**
 * Tests for the central session store (src/api/session.js).
 *
 * These pin the SPA half of the cookie-session contract introduced in
 * fontem-community-api PR #89:
 *
 * - The access token is held in memory; reads + writes go through the
 *   exported functions, never directly through localStorage.
 * - `isAuthed` flips reactively as soon as either a user record or an
 *   access token lands.
 * - `refresh()` dedupes concurrent calls so N parallel API calls that
 *   all 401 produce a single `/auth/refresh` round trip.
 * - `logout()` and `signOutEverywhere()` clear local state even if the
 *   network round trip fails.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isAuthed,
  currentUser,
  getAccessToken,
  login,
  refresh,
  logout,
  signOutEverywhere,
  _internal,
} from '../../src/api/session.js'

describe('session store', () => {
  beforeEach(() => {
    _internal.clearForTests()
    localStorage.clear()
    vi.restoreAllMocks()
  })
  afterEach(() => {
    _internal.clearForTests()
    localStorage.clear()
  })

  describe('isAuthed', () => {
    it('is false on a fresh boot', () => {
      expect(isAuthed.value).toBe(false)
    })

    it('flips true when an access token is set', () => {
      _internal.setAccessToken('access.jwt.x')
      expect(isAuthed.value).toBe(true)
    })

    it('flips true when only a user cache is set (cold-boot optimism)', () => {
      _internal.setUserForTests({ id: 'u1', email: 'a@b.com' })
      expect(isAuthed.value).toBe(true)
    })
  })

  describe('login()', () => {
    it('accepts an access token + user, exposes both', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'access.jwt.x',
          expires_in: 900,
          user: { id: 'u1', email: 'a@b.com', name: 'A' },
        }),
      })
      vi.stubGlobal('fetch', fetchMock)
      await login('a@b.com', 'pw12345678')
      expect(getAccessToken()).toBe('access.jwt.x')
      expect(currentUser.value.email).toBe('a@b.com')
      expect(isAuthed.value).toBe(true)
      // The fetch call must include credentials so the Set-Cookie
      // refresh header is honoured by the browser.
      const opts = fetchMock.mock.calls[0][1]
      expect(opts.credentials).toBe('include')
    })

    it('throws on a 401 and leaves state empty', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false, status: 401,
        json: async () => ({ detail: 'Invalid email or password' }),
      }))
      await expect(login('a@b.com', 'wrong')).rejects.toThrow(/Invalid/)
      expect(isAuthed.value).toBe(false)
    })
  })

  describe('refresh()', () => {
    it('dedupes concurrent calls into one round trip', async () => {
      let resolved = 0
      const fetchMock = vi.fn().mockImplementation(() =>
        new Promise((res) => setTimeout(() => {
          resolved++
          res({
            ok: true,
            json: async () => ({
              access_token: `access.${resolved}`,
              user: { id: 'u1', email: 'a@b.com', name: 'A' },
            }),
          })
        }, 5)),
      )
      vi.stubGlobal('fetch', fetchMock)
      const [a, b, c] = await Promise.all([refresh(), refresh(), refresh()])
      expect(fetchMock.mock.calls.length).toBe(1)
      expect(a).toBe(true)
      expect(b).toBe(true)
      expect(c).toBe(true)
      expect(getAccessToken()).toBe('access.1')
    })

    it('clears state on refresh failure', async () => {
      _internal.setAccessToken('stale.jwt')
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false, status: 401, json: async () => ({}),
      }))
      const ok = await refresh()
      expect(ok).toBe(false)
      expect(getAccessToken()).toBeNull()
      expect(isAuthed.value).toBe(false)
    })
  })

  describe('logout()', () => {
    it('POSTs /auth/logout with credentials + clears state', async () => {
      _internal.setAccessToken('access.jwt.x')
      _internal.setUserForTests({ id: 'u1', email: 'a@b.com', name: 'A' })
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
      vi.stubGlobal('fetch', fetchMock)
      await logout()
      expect(fetchMock.mock.calls[0][0]).toBe('/capi/auth/logout')
      expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
      expect(getAccessToken()).toBeNull()
      expect(currentUser.value).toBeNull()
    })

    it('still clears state when the network call fails', async () => {
      _internal.setAccessToken('access.jwt.x')
      _internal.setUserForTests({ id: 'u1', email: 'a@b.com', name: 'A' })
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
      await logout()
      expect(getAccessToken()).toBeNull()
      expect(currentUser.value).toBeNull()
    })

    it('wipes the legacy gmr-token + gmr-user keys', async () => {
      localStorage.setItem('gmr-token', 'legacy')
      localStorage.setItem('gmr-user', '{}')
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
      await logout()
      expect(localStorage.getItem('gmr-token')).toBeNull()
      expect(localStorage.getItem('gmr-user')).toBeNull()
    })
  })

  describe('signOutEverywhere()', () => {
    it('sends the access JWT and clears local state', async () => {
      _internal.setAccessToken('access.jwt.x')
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, sessions_revoked: 3 }),
      })
      vi.stubGlobal('fetch', fetchMock)
      await signOutEverywhere()
      const opts = fetchMock.mock.calls[0][1]
      expect(opts.headers.Authorization).toBe('Bearer access.jwt.x')
      expect(getAccessToken()).toBeNull()
    })

    it('no-ops gracefully when there is no access token', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      await signOutEverywhere()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(isAuthed.value).toBe(false)
    })
  })
})

describe('restoreSession bootstrap-token seam', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear(); vi.restoreAllMocks(); delete globalThis.__FONTEM_BOOTSTRAP_TOKEN__ })
  afterEach(() => { _internal.clearForTests(); localStorage.clear(); delete globalThis.__FONTEM_BOOTSTRAP_TOKEN__ })

  it('uses an injected bootstrap token instead of a cookie refresh', async () => {
    const { restoreSession, getAccessToken } = await import('../../src/api/session.js')
    const fetchMock = vi.fn()  // must NOT be called
    vi.stubGlobal('fetch', fetchMock)
    globalThis.__FONTEM_BOOTSTRAP_TOKEN__ = 'injected.test.jwt'
    await restoreSession()
    expect(getAccessToken()).toBe('injected.test.jwt')
    expect(fetchMock).not.toHaveBeenCalled()  // no /auth/refresh
  })

  it('falls back to cookie refresh when no bootstrap token is set', async () => {
    const { restoreSession } = await import('../../src/api/session.js')
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ access_token: 't', user: { id: 'u1' } }) }))
    vi.stubGlobal('fetch', fetchMock)
    await restoreSession()
    expect(fetchMock).toHaveBeenCalledWith('/capi/auth/refresh', expect.anything())
  })
})
