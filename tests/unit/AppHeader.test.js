import { _internal } from '../../src/api/session.js'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
import AppHeader from '../../src/components/AppHeader.vue'

const TickerSearchStub = { name: 'TickerSearch', template: '<div data-testid="ticker-search" />', props: ['compact'], emits: ['select'] }

function makeRouter() {
  return createRouter({ history: createMemoryHistory(), routes: ['/', '/login', '/spending', '/map', '/my-stories', '/account', '/ai-usage', '/activity', '/c/:ticker/:view'].map((p) => ({ path: p, component: { template: '<div/>' } })) })
}
async function mountAt(path = '/') {
  const router = makeRouter(); await router.push(path); await router.isReady()
  const wrapper = mount(AppHeader, { global: { plugins: [router, makeTestI18n()], stubs: { TickerSearch: TickerSearchStub } } })
  await flushPromises(); return { wrapper, router }
}

describe('AppHeader (bezel bar)', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear() })
  afterEach(() => { _internal.clearForTests(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('renders the Arguit wordmark', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('h1').text()).toBe('Arguit')
  })
  it('shows the mobile nav-toggle (hamburger) off the login page', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="nav-toggle"]').exists()).toBe(true)
  })
  it('on /login the mark is a home link, not a menu toggle', async () => {
    const { wrapper, router } = await mountAt('/login')
    const btn = wrapper.find('[data-testid="nav-toggle"]')
    expect(btn.exists()).toBe(true)
    const pushSpy = vi.spyOn(router, 'push')
    await btn.trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/')
  })
  it('below the desktop breakpoint the mark opens the mobile drawer', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false }))) // narrow
    const { wrapper } = await mountAt('/')
    const { useSidebar } = await import('../../src/composables/useSidebar.js')
    const s = useSidebar(); s.closeMobile()
    await wrapper.find('[data-testid="nav-toggle"]').trigger('click')
    expect(s.mobileOpen.value).toBe(true)
    s.closeMobile()
  })
  it('at the desktop breakpoint the mark collapses the persistent rail', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true }))) // wide
    const { wrapper } = await mountAt('/')
    const { useSidebar } = await import('../../src/composables/useSidebar.js')
    const s = useSidebar()
    s.closeMobile()
    const before = s.collapsed.value
    await wrapper.find('[data-testid="nav-toggle"]').trigger('click')
    expect(s.collapsed.value).toBe(!before) // toggled the rail, not the drawer
    expect(s.mobileOpen.value).toBe(false)
    if (s.collapsed.value !== before) s.toggleCollapsed() // restore
  })
  it('shows the profile/login surface (login when anon)', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="header-login"]').exists()).toBe(true)
  })
  it('shows the header search on `/`', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.findComponent({ name: 'TickerSearch' }).exists()).toBe(true)
  })
  it('hides the header search on /spending', async () => {
    const { wrapper } = await mountAt('/spending')
    expect(wrapper.findComponent({ name: 'TickerSearch' }).exists()).toBe(false)
  })
  it('hides search on /login', async () => {
    const { wrapper } = await mountAt('/login')
    expect(wrapper.findComponent({ name: 'TickerSearch' }).exists()).toBe(false)
  })
  it('preserves current view when selecting a ticker', async () => {
    const { wrapper, router } = await mountAt('/c/AAPL/gmr-long')
    const pushSpy = vi.spyOn(router, 'push')
    await wrapper.findComponent({ name: 'TickerSearch' }).vm.$emit('select', 'MSFT')
    expect(pushSpy).toHaveBeenCalledWith('/c/MSFT/gmr-long')
  })
})
