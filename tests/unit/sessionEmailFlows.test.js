/**
 * Tests for the email-verification + password-reset session functions
 * added alongside fontem-community-api #90.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  emailVerified,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  _internal,
} from '../../src/api/session.js'

describe('session email flows', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear(); vi.restoreAllMocks() })
  afterEach(() => { _internal.clearForTests(); localStorage.clear() })

  describe('emailVerified', () => {
    it('is true for anonymous (no banner)', () => {
      expect(emailVerified.value).toBe(true)
    })
    it('is false when the user object says email_verified=false', () => {
      _internal.setUserForTests({ id: 'u1', email: 'a@b.com', email_verified: false })
      expect(emailVerified.value).toBe(false)
    })
    it('is true when verified', () => {
      _internal.setUserForTests({ id: 'u1', email: 'a@b.com', email_verified: true })
      expect(emailVerified.value).toBe(true)
    })
    it('is true for a legacy user object missing the field', () => {
      _internal.setUserForTests({ id: 'u1', email: 'a@b.com' })
      expect(emailVerified.value).toBe(true)
    })
  })

  describe('verifyEmail', () => {
    it('POSTs the token then refreshes the session', async () => {
      const calls = []
      vi.stubGlobal('fetch', vi.fn(async (url) => {
        calls.push(url)
        if (url === '/capi/auth/verify-email') {
          return { ok: true, json: async () => ({ ok: true }) }
        }
        if (url === '/capi/auth/refresh') {
          return { ok: true, json: async () => ({
            access_token: 't', user: { id: 'u1', email_verified: true },
          }) }
        }
        throw new Error('unmatched: ' + url)
      }))
      await verifyEmail('tok123')
      expect(calls).toContain('/capi/auth/verify-email')
      expect(calls).toContain('/capi/auth/refresh')
      expect(emailVerified.value).toBe(true)
    })
    it('throws on a bad token', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: false, status: 400, json: async () => ({ detail: 'invalid' }),
      })))
      await expect(verifyEmail('bad')).rejects.toThrow(/invalid/)
    })
  })

  describe('resendVerification', () => {
    it('sends the access token in the auth header', async () => {
      _internal.setAccessToken('access.jwt')
      const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }))
      vi.stubGlobal('fetch', fetchMock)
      await resendVerification()
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer access.jwt')
    })
  })

  describe('forgotPassword', () => {
    it('resolves silently on 200', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })))
      await expect(forgotPassword('a@b.com')).resolves.toBeUndefined()
    })
    it('does not throw on a non-5xx even-if-not-ok (no enumeration)', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 200, json: async () => ({}) })))
      await expect(forgotPassword('a@b.com')).resolves.toBeUndefined()
    })
    it('throws only on a true 5xx', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })))
      await expect(forgotPassword('a@b.com')).rejects.toThrow()
    })
  })

  describe('resetPassword', () => {
    it('POSTs token + new_password', async () => {
      const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }))
      vi.stubGlobal('fetch', fetchMock)
      await resetPassword('tok', 'newpassword123')
      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.token).toBe('tok')
      expect(body.new_password).toBe('newpassword123')
    })
    it('throws on an expired token', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: false, status: 400, json: async () => ({ detail: 'expired' }),
      })))
      await expect(resetPassword('old', 'newpassword123')).rejects.toThrow(/expired/)
    })
  })
})
