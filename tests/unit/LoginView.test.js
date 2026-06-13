/**
 * LoginView — registration password confirmation regression.
 *
 * The registration form used to accept a single password and submit it
 * straight to /capi/auth/register. With no second field, a user who
 * typo'd their password silently created an account they could never
 * sign back in to. These tests pin the contract: a second password
 * field is required, the submit button is disabled while the two
 * fields don't match, a mismatch message renders, and only matching
 * passwords reach the network.
 */
import { _internal } from '../../src/api/session.js'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

import LoginView from '../../src/views/LoginView.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/login', component: LoginView },
    ],
  })
}

async function mountAt(path = '/login') {
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(LoginView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return { wrapper, router }
}

// `window.google` stays undefined → onMounted's waitForGoogle just polls
// silently. That's fine for these tests; we don't exercise the Google
// SSO path. `window.location.href` is replaced so the navigate-on-success
// path doesn't blow up jsdom.
beforeEach(() => {
  _internal.clearForTests(); localStorage.clear()
  window.location.href = 'about:blank'
  globalThis.fetch = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LoginView — registration password confirmation', () => {
  it('renders the confirm-password input on the register tab', async () => {
    const { wrapper } = await mountAt()
    await wrapper.get('button:nth-child(2)').trigger('click')   // "Create account" tab
    expect(wrapper.find('[data-testid="reg-password"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reg-password-confirm"]').exists()).toBe(true)
  })

  it('disables the submit button while the confirm field does not match', async () => {
    const { wrapper } = await mountAt()
    await wrapper.get('button:nth-child(2)').trigger('click')
    await wrapper.get('[data-testid="reg-name"]').setValue('Test User')
    await wrapper.get('[data-testid="reg-email"]').setValue('user@example.com')
    await wrapper.get('[data-testid="reg-password"]').setValue('SecurePass123')
    await wrapper.get('[data-testid="reg-password-confirm"]').setValue('SecurePass124')
    expect(wrapper.get('[data-testid="reg-submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="reg-password-mismatch"]').text()).toMatch(/match/i)
  })

  it('does not show a mismatch error while confirm is empty (only after first touch)', async () => {
    const { wrapper } = await mountAt()
    await wrapper.get('button:nth-child(2)').trigger('click')
    await wrapper.get('[data-testid="reg-password"]').setValue('SecurePass123')
    // confirm still empty → no error, button still enabled (but
    // unsubmittable for other reasons — minlength + required).
    expect(wrapper.find('[data-testid="reg-password-mismatch"]').exists()).toBe(false)
  })

  it('clears the mismatch and enables submit once the two fields match', async () => {
    const { wrapper } = await mountAt()
    await wrapper.get('button:nth-child(2)').trigger('click')
    await wrapper.get('[data-testid="reg-name"]').setValue('Test User')
    await wrapper.get('[data-testid="reg-email"]').setValue('user@example.com')
    await wrapper.get('[data-testid="reg-password"]').setValue('SecurePass123')
    await wrapper.get('[data-testid="reg-password-confirm"]').setValue('mismatch')
    expect(wrapper.get('[data-testid="reg-submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="reg-password-confirm"]').setValue('SecurePass123')
    expect(wrapper.get('[data-testid="reg-submit"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="reg-password-mismatch"]').exists()).toBe(false)
  })

  it('does not POST to /capi/auth/register when passwords mismatch', async () => {
    const { wrapper } = await mountAt()
    await wrapper.get('button:nth-child(2)').trigger('click')
    await wrapper.get('[data-testid="reg-name"]').setValue('Test User')
    await wrapper.get('[data-testid="reg-email"]').setValue('user@example.com')
    await wrapper.get('[data-testid="reg-password"]').setValue('SecurePass123')
    await wrapper.get('[data-testid="reg-password-confirm"]').setValue('different')
    // Force-submit the form so we hit the handler even with the button
    // disabled (a malicious client could re-enable it). Confirms the
    // handler itself rejects mismatched passwords, not just the button.
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="login-error"]').text()).toMatch(/match/i)
  })

  it('POSTs to /capi/auth/register only when the passwords match', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'tok', user: { email: 'user@example.com' },
      }),
    })
    const { wrapper } = await mountAt()
    await wrapper.get('button:nth-child(2)').trigger('click')
    await wrapper.get('[data-testid="reg-name"]').setValue('Test User')
    await wrapper.get('[data-testid="reg-email"]').setValue('user@example.com')
    await wrapper.get('[data-testid="reg-password"]').setValue('SecurePass123')
    await wrapper.get('[data-testid="reg-password-confirm"]').setValue('SecurePass123')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [url, opts] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('/capi/auth/register')
    const body = JSON.parse(opts.body)
    expect(body.email).toBe('user@example.com')
    expect(body.password).toBe('SecurePass123')
    // The backend never receives the confirm field — that's only a
    // UI contract. Pin so a refactor doesn't accidentally leak it.
    expect(body.password_confirm).toBeUndefined()
  })
})
