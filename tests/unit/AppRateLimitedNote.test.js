/**
 * The rate-limited footnote: when the retry wrapper is absorbing a 429,
 * the shell says so — a reddish one-liner pinned to the bottom — instead
 * of the page just quietly missing data.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
import App from '../../src/App.vue'
import { rateLimited } from '../../src/api/_retry.js'

const STUBS = {
  AppHeader: true,
  AppSidebar: true,
  AppFooter: true,
  VerifyEmailBanner: true,
  CookieConsentBanner: true,
  ToastStack: true,
  AssistPanel: true,
  I18nPluralProbe: true,
  RouterView: true,
}

async function mountApp() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div/>' } }],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(App, {
    global: { plugins: [router, makeTestI18n()], stubs: STUBS },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  // Another test file can leave a broken matchMedia stub behind (the suite
  // does not isolate globals between files); App's useTheme.init needs a
  // working one to mount at all.
  globalThis.window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })
})

afterEach(() => { rateLimited.value = false })

describe('rate-limited footnote', () => {
  it('is absent while nothing is being retried', async () => {
    const wrapper = await mountApp()
    expect(wrapper.find('[data-testid="rate-limited-note"]').exists()).toBe(false)
  })

  it('appears with the translated notice while a retry waits, then clears', async () => {
    const wrapper = await mountApp()
    rateLimited.value = true
    await nextTick()
    const note = wrapper.find('[data-testid="rate-limited-note"]')
    expect(note.exists()).toBe(true)
    expect(note.attributes('role')).toBe('status')
    expect(note.text()).toContain('retrying in a few seconds')

    rateLimited.value = false
    await nextTick()
    expect(wrapper.find('[data-testid="rate-limited-note"]').exists()).toBe(false)
  })
})
