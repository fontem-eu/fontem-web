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

  // The banner sits at z-index 1000 above everything, including the AssistPanel
  // input row. Other components (chiefly AssistPanel.vue) read the
  // `--cookie-banner-h` CSS custom property on <html> to pad themselves
  // above the banner while it's visible. The two tests below pin that
  // contract: the var is non-zero while the banner is up, and goes back
  // to zero once the user dismisses it.
  it('sets --cookie-banner-h on <html> while the banner is visible', async () => {
    await mountBanner()
    const offset = document.documentElement.style.getPropertyValue('--cookie-banner-h')
    expect(offset).toBe('6rem')
  })

  it('clears --cookie-banner-h after the user dismisses the banner', async () => {
    await mountBanner()
    document.querySelector('[data-testid="cookie-consent-accept"]').click()
    await flushPromises()
    const offset = document.documentElement.style.getPropertyValue('--cookie-banner-h')
    expect(offset).toBe('0px')
  })

  it('does not set --cookie-banner-h when consent was already given before mount', async () => {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    await mountBanner()
    // The watcher fires with `visible=false` on first run so the offset
    // is explicitly zeroed (not just left at its previous value, which
    // could survive a hot-module-reload).
    const offset = document.documentElement.style.getPropertyValue('--cookie-banner-h')
    expect(offset).toBe('0px')
  })
})
