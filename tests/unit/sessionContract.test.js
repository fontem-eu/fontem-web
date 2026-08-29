/**
 * Fetch-contract tests for the session/auth client: pin the exact URL,
 * method, credentials and body of every auth call, the error fallbacks,
 * and the cold-boot bootstrap-token seam. Behavioural flows (refresh
 * rotation etc.) live in session.test.js / sessionEmailFlows.test.js.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  login, logout, signOutEverywhere, verifyEmail, resendVerification,
  forgotPassword, resetPassword, restoreSession, getAccessToken,
  setSessionAvatar, setSessionName, currentUser, _internal,
} from '../../src/api/session.js'

const originalFetch = globalThis.fetch
const okAuth = (user = { id: 'u1', name: 'U' }) => ({
  ok: true, json: async () => ({ access_token: 'tok-1', user }),
})

beforeEach(() => {
  globalThis.fetch = vi.fn()
  _internal.clearForTests()
  localStorage.clear()
})
afterEach(() => {
  globalThis.fetch = originalFetch
  delete globalThis.__FONTEM_BOOTSTRAP_TOKEN__
})

describe('login contract', () => {
  it('POSTs credentials to /capi/auth/login with cookies enabled', async () => {
    globalThis.fetch.mockResolvedValue(okAuth())
    await login('a@b.c', 'pw')
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('/capi/auth/login')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.c', password: 'pw' })
  })

  it('stores the token and persists the user under fontem-user', async () => {
    globalThis.fetch.mockResolvedValue(okAuth({ id: 'u9' }))
    await login('a@b.c', 'pw')
    expect(getAccessToken()).toBe('tok-1')
    expect(JSON.parse(localStorage.getItem('fontem-user'))).toEqual({ id: 'u9' })
  })

  it('keeps the current user untouched when the response has none', async () => {
    globalThis.fetch.mockResolvedValue(okAuth())
    await login('a@b.c', 'pw')
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ access_token: 'tok-2' }) })
    await login('a@b.c', 'pw')
    expect(currentUser.value).toEqual({ id: 'u1', name: 'U' })
    expect(getAccessToken()).toBe('tok-2')
  })

  it('surfaces the server detail, falling back to HTTP <status>', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: 'Bad credentials' }) })
    await expect(login('a@b.c', 'x')).rejects.toThrow('Bad credentials')
    globalThis.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('not json') } })
    await expect(login('a@b.c', 'x')).rejects.toThrow('HTTP 500')
  })
})

describe('session patches', () => {
  it('setSessionAvatar updates and persists only when signed in', () => {
    setSessionAvatar('https://x/a.png')
    expect(localStorage.getItem('fontem-user')).toBeNull()
    _internal.setUserForTests({ id: 'u1' })
    setSessionAvatar('https://x/a.png')
    expect(currentUser.value.avatar_url).toBe('https://x/a.png')
    expect(JSON.parse(localStorage.getItem('fontem-user')).avatar_url).toBe('https://x/a.png')
  })

  it('setSessionName updates and persists, ignoring empty names', () => {
    _internal.setUserForTests({ id: 'u1', name: 'Old' })
    setSessionName('')
    expect(currentUser.value.name).toBe('Old')
    setSessionName('New')
    expect(currentUser.value.name).toBe('New')
    expect(JSON.parse(localStorage.getItem('fontem-user')).name).toBe('New')
  })
})

describe('logout / sign out everywhere', () => {
  it('logout POSTs /capi/auth/logout with cookies and clears even on network failure', async () => {
    _internal.setAccessToken('tok')
    globalThis.fetch.mockRejectedValue(new Error('offline'))
    await logout()
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('/capi/auth/logout')
    expect(init).toEqual({ method: 'POST', credentials: 'include' })
    expect(getAccessToken()).toBeNull()
    expect(localStorage.getItem('fontem-user')).toBeNull()
  })

  it('signOutEverywhere skips the network entirely when anonymous', async () => {
    await signOutEverywhere()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('signOutEverywhere sends the bearer token and clears even on failure', async () => {
    _internal.setAccessToken('tok-9')
    globalThis.fetch.mockRejectedValue(new Error('offline'))
    await expect(signOutEverywhere()).rejects.toThrow('offline')
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('/capi/auth/sign_out_everywhere')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.headers).toEqual({ Authorization: 'Bearer tok-9' })
    expect(getAccessToken()).toBeNull()
  })
})

describe('email verification contract', () => {
  it('verifyEmail POSTs the token then refreshes the session', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce(okAuth({ id: 'u1', email_verified: true }))
    await verifyEmail('t-123')
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('/capi/auth/verify-email')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ token: 't-123' })
    expect(globalThis.fetch.mock.calls[1][0]).toBe('/capi/auth/refresh')
  })

  it('verifyEmail falls back to the invalid-link message', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({}) })
    await expect(verifyEmail('t')).rejects.toThrow('Verification link is invalid or expired.')
    globalThis.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: 'Custom' }) })
    await expect(verifyEmail('t')).rejects.toThrow('Custom')
  })

  it('resendVerification sends the bearer header only when signed in', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await resendVerification()
    expect(globalThis.fetch.mock.calls[0][0]).toBe('/capi/auth/resend-verification')
    expect(globalThis.fetch.mock.calls[0][1].headers).toEqual({})
    _internal.setAccessToken('tok-5')
    await resendVerification()
    expect(globalThis.fetch.mock.calls[1][1].headers).toEqual({ Authorization: 'Bearer tok-5' })
    globalThis.fetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) })
    await expect(resendVerification()).rejects.toThrow('Could not resend the verification email.')
  })
})

describe('password reset contract', () => {
  it('forgotPassword POSTs the email and stays silent on 4xx (enumeration-safe)', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) })
    await expect(forgotPassword('a@b.c')).resolves.toBeUndefined()
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('/capi/auth/forgot')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.c' })
  })

  it('forgotPassword throws the generic message from 500 up', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    await expect(forgotPassword('a@b.c')).rejects.toThrow('Something went wrong. Please try again.')
  })

  it('resetPassword POSTs token + new password with its fallback message', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await resetPassword('t-1', 'npw')
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('/capi/auth/reset')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ token: 't-1', new_password: 'npw' })
    globalThis.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({}) })
    await expect(resetPassword('t', 'x')).rejects.toThrow('Reset link is invalid or expired.')
  })
})

describe('cold-boot restore', () => {
  it('uses the bootstrap token seam without any network call', async () => {
    globalThis.__FONTEM_BOOTSTRAP_TOKEN__ = 'boot-tok'
    await restoreSession()
    expect(getAccessToken()).toBe('boot-tok')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('falls back to one cookie refresh when no bootstrap token is set', async () => {
    const cancel = vi.fn()
    globalThis.fetch.mockResolvedValue({ ok: false, status: 401, body: { cancel } })
    await restoreSession()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch.mock.calls[0][0]).toBe('/capi/auth/refresh')
    // the unread 401 body must be released (no-store hang regression)
    expect(cancel).toHaveBeenCalled()
    // idempotent: a second call reuses the settled promise
    await restoreSession()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})
