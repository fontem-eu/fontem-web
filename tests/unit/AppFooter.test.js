import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
import { _internal } from '../../src/api/session.js'
import AppFooter from '../../src/components/AppFooter.vue'

function makeRouter() {
  const paths = ['/', '/privacy', '/data-quality', '/sparql', '/about', '/help', '/development', '/admin']
  return createRouter({
    history: createMemoryHistory(),
    routes: paths.map((p) => ({ path: p, component: { template: '<div/>' } })),
  })
}

async function mountFooter() {
  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  const w = mount(AppFooter, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return w
}

describe('AppFooter admin link', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear() })
  afterEach(() => { _internal.clearForTests(); localStorage.clear(); vi.restoreAllMocks() })

  it('is hidden from anonymous visitors', async () => {
    const w = await mountFooter()
    expect(w.find('[data-testid="footer-admin"]').exists()).toBe(false)
  })

  it('is hidden from an ordinary member', async () => {
    _internal.setAccessToken('t')
    _internal.setUserForTests({ name: 'U', email: 'u@x.com', trust_level: 'contributor' })
    const w = await mountFooter()
    expect(w.find('[data-testid="footer-admin"]').exists()).toBe(false)
  })

  it('shows for an admin, reading the session rather than a legacy storage key', async () => {
    // Regression: this read `gmr-user` from localStorage, which the session
    // has not written since the rename — only cleared. The link was live in
    // the markup and shown to nobody.
    _internal.setAccessToken('t')
    _internal.setUserForTests({ name: 'A', email: 'a@x.com', trust_level: 'admin' })
    expect(localStorage.getItem('gmr-user')).toBeNull()

    const w = await mountFooter()
    const link = w.find('[data-testid="footer-admin"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/admin')
  })

  it('shows for a moderator', async () => {
    _internal.setAccessToken('t')
    _internal.setUserForTests({ name: 'M', email: 'm@x.com', trust_level: 'moderator' })
    const w = await mountFooter()
    expect(w.find('[data-testid="footer-admin"]').exists()).toBe(true)
  })
})
