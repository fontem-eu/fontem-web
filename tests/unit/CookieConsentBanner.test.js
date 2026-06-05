import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
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
    global: { plugins: [router, makeTestI18n()] },
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
  // above the banner while it's visible. The three tests below pin that
  // contract: the var is set while the banner is up, picks up the real
  // rendered height once the ResizeObserver fires, and goes back to
  // zero once the user dismisses it.
  it('sets --cookie-banner-h on <html> while the banner is visible', async () => {
    await mountBanner()
    const offset = document.documentElement.style.getPropertyValue('--cookie-banner-h')
    // Before the first ResizeObserver tick we publish the safe fallback.
    // jsdom doesn't actually run ResizeObserver, so the fallback is what
    // survives — and it MUST be non-zero (otherwise nothing reserves
    // space above the banner).
    expect(offset).not.toBe('')
    expect(offset).not.toBe('0px')
  })

  it('publishes the measured banner BORDER-BOX height to --cookie-banner-h via ResizeObserver', async () => {
    // jsdom ships no ResizeObserver. Stub it so we can verify the
    // CookieConsentBanner observes the dialog and writes the rendered
    // size to the CSS var. The first ResizeObserver iteration here
    // used `entry.contentRect.height` (content box, no padding/border)
    // — short by ~33 px on mobile because the banner has 1 rem of
    // padding on each side, which let the bottom of the banner peek
    // above the AssistPanel's reserved padding-bottom. Switch to the
    // border-box dimensions so the var reflects the on-screen footprint.
    let observerCb
    const observe = vi.fn()
    const disconnect = vi.fn()
    globalThis.ResizeObserver = vi.fn((cb) => {
      observerCb = cb
      return { observe, disconnect }
    })

    await mountBanner()
    await flushPromises()

    expect(observe).toHaveBeenCalledTimes(1)
    expect(typeof observerCb).toBe('function')

    // Banner at iPhone-13 mobile width: 110 px content + 32 px vertical
    // padding + 1 px top border = 143 px border-box. The CSS var must
    // match the BORDER-BOX value (143), not the content-rect value (110).
    observerCb([
      {
        borderBoxSize: [{ blockSize: 143 }],
        contentRect: { height: 110 },
        target: { offsetHeight: 143 },
      },
    ])
    expect(document.documentElement.style.getPropertyValue('--cookie-banner-h'))
      .toBe('143px')

    // Fallback path: some browsers (older Safari) don't report
    // borderBoxSize. The observer should fall back to offsetHeight,
    // which also includes padding + border.
    observerCb([
      {
        contentRect: { height: 99 },
        target: { offsetHeight: 132 },
      },
    ])
    expect(document.documentElement.style.getPropertyValue('--cookie-banner-h'))
      .toBe('132px')

    delete globalThis.ResizeObserver
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
    // The banner isn't mounted on this branch, so the offset stays at
    // its initial empty value (no other component should have set it).
    const offset = document.documentElement.style.getPropertyValue('--cookie-banner-h')
    expect(offset === '' || offset === '0px').toBe(true)
  })
})
