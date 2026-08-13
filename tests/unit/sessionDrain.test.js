import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * A fetch whose body is never read leaves the stream open.
 *
 * The browser normally drains it into the HTTP cache and the request
 * completes anyway — but a response marked `Cache-Control: no-store` cannot
 * be cached, so nothing drains it and the request stays pending for the
 * life of the page.
 *
 * Adding no-store to the API (correctly: those are private records) turned
 * that latent sloppiness into a hang. Every anonymous page load fired
 * POST /auth/refresh, got its 401, and left the body unread; Playwright's
 * `networkidle` never fired and the i18n landing tests timed out at 60s
 * with exactly one request in flight — reproduced 3/3 against testing and
 * 0/3 against staging, which was still on the build without the header.
 */
describe('session: responses we do not read are released', () => {
  beforeEach(() => { vi.resetModules(); localStorage.clear() })

  const res = (ok, cancel) => ({
    ok,
    status: ok ? 200 : 401,
    body: { cancel },
    json: async () => ({ access_token: 't', user: { id: 'u' } }),
  })

  it('releases the body of a failed refresh', async () => {
    const cancel = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => res(false, cancel)))
    const { refresh } = await import('../../src/api/session.js')
    await expect(refresh()).resolves.toBe(false)
    expect(cancel, 'the 401 body must be released or the request hangs')
      .toHaveBeenCalled()
  })

  it('does not cancel a successful refresh — that body is read', async () => {
    const cancel = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => res(true, cancel)))
    const { refresh } = await import('../../src/api/session.js')
    await expect(refresh()).resolves.toBe(true)
    expect(cancel).not.toHaveBeenCalled()
  })

  it('releases the logout body', async () => {
    const cancel = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => res(true, cancel)))
    const { logout } = await import('../../src/api/session.js')
    await logout()
    expect(cancel).toHaveBeenCalled()
  })

  it('survives a response with no body at all', async () => {
    // 204s and opaque responses have none; the helper must not throw.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })))
    const { refresh } = await import('../../src/api/session.js')
    await expect(refresh()).resolves.toBe(false)
  })

  it('survives a body whose cancel throws', async () => {
    const cancel = vi.fn(() => { throw new Error('already locked') })
    vi.stubGlobal('fetch', vi.fn(async () => res(false, cancel)))
    const { refresh } = await import('../../src/api/session.js')
    await expect(refresh()).resolves.toBe(false)
  })
})
