import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { _internal } from '../../src/api/session.js'
import VerifyEmailBanner from '../../src/components/VerifyEmailBanner.vue'

describe('VerifyEmailBanner', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear(); vi.restoreAllMocks() })
  afterEach(() => { _internal.clearForTests(); localStorage.clear() })

  it('is hidden for anonymous visitors', () => {
    const w = mount(VerifyEmailBanner)
    expect(w.find('[data-testid="verify-email-banner"]').exists()).toBe(false)
  })

  it('is hidden for a verified user', () => {
    _internal.setUserForTests({ id: 'u1', email: 'a@b.com', email_verified: true })
    const w = mount(VerifyEmailBanner)
    expect(w.find('[data-testid="verify-email-banner"]').exists()).toBe(false)
  })

  it('shows for an unverified user', () => {
    _internal.setUserForTests({ id: 'u1', email: 'a@b.com', email_verified: false })
    const w = mount(VerifyEmailBanner)
    expect(w.find('[data-testid="verify-email-banner"]').exists()).toBe(true)
    expect(w.find('[data-testid="verify-banner-resend"]').exists()).toBe(true)
  })

  it('resend calls the endpoint and shows the sent state', async () => {
    _internal.setUserForTests({ id: 'u1', email: 'a@b.com', email_verified: false })
    _internal.setAccessToken('access.jwt')
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }))
    vi.stubGlobal('fetch', fetchMock)
    const w = mount(VerifyEmailBanner)
    await w.find('[data-testid="verify-banner-resend"]').trigger('click')
    await flushPromises()
    expect(fetchMock.mock.calls[0][0]).toBe('/capi/auth/resend-verification')
    expect(w.find('[data-testid="verify-banner-sent"]').exists()).toBe(true)
  })
})
