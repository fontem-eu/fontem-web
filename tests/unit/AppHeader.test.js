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
      { path: '/feed', component: { template: '<div />' } },
      { path: '/my-reports', component: { template: '<div />' } },
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

  it('renders the GMR logo', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('h1').text()).toContain('GMR')
  })

  it('shows Sign in button when not authenticated', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="sign-in-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sign-out-btn"]').exists()).toBe(false)
  })

  it('shows profile menu trigger when authenticated', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="profile-menu-trigger"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sign-in-btn"]').exists()).toBe(false)
  })

  it('shows Sign out button in profile dropdown', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper } = await mountAt('/')
    await wrapper.find('[data-testid="profile-menu-trigger"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="sign-out-btn"]').exists()).toBe(true)
  })

  it('shows nav tabs when authenticated', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper } = await mountAt('/')
    const nav = wrapper.find('[data-testid="app-nav"]')
    expect(nav.exists()).toBe(true)
    expect(nav.text()).toContain('Home')
    expect(nav.text()).toContain('Feed')
    expect(nav.text()).toContain('My Reports')
  })

  it('moves Issues and Activity out of the top-level nav', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper } = await mountAt('/')
    const nav = wrapper.find('[data-testid="app-nav"]')
    expect(nav.text()).not.toContain('Issues')
    expect(nav.text()).not.toContain('Activity')
  })

  it('shows Home + Feed nav tabs to anonymous visitors (My Reports is hidden)', async () => {
    const { wrapper } = await mountAt('/')
    const nav = wrapper.find('[data-testid="app-nav"]')
    expect(nav.exists()).toBe(true)
    expect(nav.text()).toContain('Home')
    expect(nav.text()).toContain('Feed')
    expect(nav.text()).not.toContain('My Reports')
  })

  it('hides nav tabs on the login page regardless of auth state', async () => {
    const { wrapper } = await mountAt('/login')
    expect(wrapper.find('[data-testid="app-nav"]').exists()).toBe(false)
  })

  it('hides search bar on the landing page (home has its own card)', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.findComponent({ name: 'TickerSearch' }).exists()).toBe(false)
  })

  it('hides search bar on login page', async () => {
    const { wrapper } = await mountAt('/login')
    expect(wrapper.findComponent({ name: 'TickerSearch' }).exists()).toBe(false)
  })

  it('shows search bar on feed page', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper } = await mountAt('/feed')
    expect(wrapper.findComponent({ name: 'TickerSearch' }).exists()).toBe(true)
  })

  it('marks active nav tab', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper } = await mountAt('/my-reports')
    const tab = wrapper.find('[data-testid="nav-my-reports"]')
    expect(tab.classes()).toContain('active')
  })

  it('shows user name in profile dropdown', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    localStorage.setItem('gmr-user', JSON.stringify({ name: 'Alice', email: 'a@b.com' }))
    const { wrapper } = await mountAt('/')
    await wrapper.find('[data-testid="profile-menu-trigger"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="profile-menu"]').text()).toContain('Alice')
  })

  it('preserves current view when selecting a ticker', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper, router } = await mountAt('/c/AAPL/gmr-long')
    const pushSpy = vi.spyOn(router, 'push')
    await wrapper.findComponent({ name: 'TickerSearch' }).vm.$emit('select', 'MSFT')
    expect(pushSpy).toHaveBeenCalledWith('/c/MSFT/gmr-long')
  })
})
