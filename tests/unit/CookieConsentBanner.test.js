import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import CookieConsentBanner from '../../src/components/CookieConsentBanner.vue'

const STORAGE_KEY = 'gmr-cookie-consent'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/privacy', component: { template: '<div />' } },
    ],
  })
}

async function mountBanner() {
  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  const wrapper = mount(CookieConsentBanner, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
    document.body.innerHTML = ''
  })

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY)
    document.body.innerHTML = ''
  })

  it('shows when no choice has been made', async () => {
    await mountBanner()
    expect(document.querySelector('[data-testid="cookie-consent-banner"]')).not.toBeNull()
  })

  it('does not show when consent was previously accepted', async () => {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    await mountBanner()
    expect(document.querySelector('[data-testid="cookie-consent-banner"]')).toBeNull()
  })

  it('does not show when consent was previously declined', async () => {
    localStorage.setItem(STORAGE_KEY, 'declined')
    await mountBanner()
    expect(document.querySelector('[data-testid="cookie-consent-banner"]')).toBeNull()
  })

  it('persists "accepted" and hides on Accept click', async () => {
    await mountBanner()
    const acceptBtn = document.querySelector('[data-testid="cookie-consent-accept"]')
    acceptBtn.click()
    await flushPromises()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('accepted')
    expect(document.querySelector('[data-testid="cookie-consent-banner"]')).toBeNull()
  })

  it('persists "declined" and hides on Decline click', async () => {
    await mountBanner()
    const declineBtn = document.querySelector('[data-testid="cookie-consent-decline"]')
    declineBtn.click()
    await flushPromises()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('declined')
    expect(document.querySelector('[data-testid="cookie-consent-banner"]')).toBeNull()
  })
})
