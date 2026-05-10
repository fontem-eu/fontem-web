import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppHeader from '../../src/components/AppHeader.vue'

const TickerSearchStub = {
  name: 'TickerSearch',
  template: '<div data-testid="ticker-search" />',
  props: ['compact'],
  emits: ['select'],
}

const ThemeToggleStub = { template: '<div data-testid="theme-toggle" />' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
      { path: '/spending', component: { template: '<div />' } },
      { path: '/map', component: { template: '<div />' } },
      { path: '/my-stories', component: { template: '<div />' } },
      { path: '/reports', component: { template: '<div />' } },
      { path: '/issues', component: { template: '<div />' } },
      { path: '/activity', component: { template: '<div />' } },
      { path: '/c/:ticker/:view', component: { template: '<div />' } },
    ],
  })
}

async function mountAt(path = '/') {
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(AppHeader, {
    global: {
      plugins: [router],
      stubs: {
        TickerSearch: TickerSearchStub,
        ThemeToggle: ThemeToggleStub,
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('AppHeader', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

  it('renders the Fontem wordmark in the header logo', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('h1').text()).toBe('Fontem')
  })

  it('preferences gear is always present', async () => {
    // The gear is the single auth + theme + lang + palette entry
    // point — visible signed-out and signed-in alike.
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="prefs-menu-trigger"]').exists()).toBe(true)
  })

  it('exposes Sign in inside the preferences menu when not authenticated', async () => {
    const { wrapper } = await mountAt('/')
    await wrapper.find('[data-testid="prefs-menu-trigger"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="prefs-sign-in"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prefs-sign-out"]').exists()).toBe(false)
  })

  it('exposes Sign out inside the preferences menu when authenticated', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper } = await mountAt('/')
    await wrapper.find('[data-testid="prefs-menu-trigger"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="prefs-sign-out"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="prefs-sign-in"]').exists()).toBe(false)
  })

  it('hides the avatar trigger for anonymous visitors', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="prefs-avatar-trigger"]').exists()).toBe(false)
  })

  it('renders the avatar trigger next to the gear when authenticated', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    localStorage.setItem('gmr-user', JSON.stringify({
      name: 'Bernardo Marques', email: 'bernardo@example.com',
    }))
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="prefs-avatar-trigger"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="user-avatar-initials"]').text()).toBe('BM')
  })

  it('clicking the avatar opens the same prefs menu as the gear', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    localStorage.setItem('gmr-user', JSON.stringify({ name: 'Bernardo' }))
    const { wrapper } = await mountAt('/')
    await wrapper.find('[data-testid="prefs-avatar-trigger"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="prefs-menu"]').exists()).toBe(true)
  })

  it('shows nav tabs when authenticated', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper } = await mountAt('/')
    const nav = wrapper.find('[data-testid="app-nav"]')
    expect(nav.exists()).toBe(true)
    expect(nav.text()).toContain('Stories')
    expect(nav.text()).toContain('Spending')
    expect(nav.text()).toContain('Map')
    expect(nav.text()).toContain('My Stories')
  })

  it('shows Map tab to anonymous visitors too', async () => {
    const { wrapper } = await mountAt('/')
    const nav = wrapper.find('[data-testid="app-nav"]')
    expect(nav.text()).toContain('Map')
    expect(wrapper.find('[data-testid="nav-map"]').attributes('href'))
      .toBe('/map')
  })

  it('shows Spending tab next to Map', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="nav-spending"]').attributes('href'))
      .toBe('/spending')
    expect(wrapper.find('[data-testid="app-nav"]').text())
      .toContain('Spending')
  })

  it('moves Issues and Activity out of the top-level nav', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper } = await mountAt('/')
    const nav = wrapper.find('[data-testid="app-nav"]')
    expect(nav.text()).not.toContain('Issues')
    expect(nav.text()).not.toContain('Activity')
  })

  it('shows Stories + Spending + Map nav tabs to anonymous visitors (My Stories hidden)', async () => {
    const { wrapper } = await mountAt('/')
    const nav = wrapper.find('[data-testid="app-nav"]')
    expect(nav.exists()).toBe(true)
    expect(nav.text()).toContain('Stories')
    expect(nav.text()).toContain('Spending')
    expect(nav.text()).toContain('Map')
    // "My Stories" auth-only — substring "Stories" is in the public
    // tab too, so check the testid instead of the label.
    expect(wrapper.find('[data-testid="nav-my-reports"]').exists()).toBe(false)
  })

  it('hides nav tabs on the login page regardless of auth state', async () => {
    const { wrapper } = await mountAt('/login')
    expect(wrapper.find('[data-testid="app-nav"]').exists()).toBe(false)
  })

  it('shows the header search on `/` (Stories landing — no embedded search)', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.findComponent({ name: 'TickerSearch' }).exists()).toBe(true)
  })

  it('hides the header search on /spending (page has its own search card)', async () => {
    const { wrapper } = await mountAt('/spending')
    expect(wrapper.findComponent({ name: 'TickerSearch' }).exists()).toBe(false)
  })

  it('hides search bar on login page', async () => {
    const { wrapper } = await mountAt('/login')
    expect(wrapper.findComponent({ name: 'TickerSearch' }).exists()).toBe(false)
  })

  it('marks active nav tab', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper } = await mountAt('/my-stories')
    const tab = wrapper.find('[data-testid="nav-my-reports"]')
    expect(tab.classes()).toContain('active')
  })

  it('shows user name inside the preferences menu when authenticated', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    localStorage.setItem('gmr-user', JSON.stringify({ name: 'Alice', email: 'a@b.com' }))
    const { wrapper } = await mountAt('/')
    await wrapper.find('[data-testid="prefs-menu-trigger"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="prefs-menu"]').text()).toContain('Alice')
  })

  it('preserves current view when selecting a ticker', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper, router } = await mountAt('/c/AAPL/gmr-long')
    const pushSpy = vi.spyOn(router, 'push')
    await wrapper.findComponent({ name: 'TickerSearch' }).vm.$emit('select', 'MSFT')
    expect(pushSpy).toHaveBeenCalledWith('/c/MSFT/gmr-long')
  })
})
