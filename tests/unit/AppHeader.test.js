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

  it('shows Sign out button when authenticated', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="sign-out-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sign-in-btn"]').exists()).toBe(false)
  })

  it('shows nav tabs when authenticated', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper } = await mountAt('/')
    const nav = wrapper.find('[data-testid="app-nav"]')
    expect(nav.exists()).toBe(true)
    expect(nav.text()).toContain('Reports')
    expect(nav.text()).toContain('Issues')
    expect(nav.text()).toContain('Activity')
  })

  it('hides nav tabs when not authenticated', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="app-nav"]').exists()).toBe(false)
  })

  it('hides search bar on landing page', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.findComponent({ name: 'TickerSearch' }).exists()).toBe(false)
  })

  it('hides search bar on login page', async () => {
    const { wrapper } = await mountAt('/login')
    expect(wrapper.findComponent({ name: 'TickerSearch' }).exists()).toBe(false)
  })

  it('shows search bar on reports page', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper } = await mountAt('/reports')
    expect(wrapper.findComponent({ name: 'TickerSearch' }).exists()).toBe(true)
  })

  it('marks active nav tab', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper } = await mountAt('/reports')
    const reportsTab = wrapper.find('[data-testid="nav-reports"]')
    expect(reportsTab.classes()).toContain('active')
  })

  it('shows user name when available', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    localStorage.setItem('gmr-user', JSON.stringify({ name: 'Alice', email: 'a@b.com' }))
    const { wrapper } = await mountAt('/')
    expect(wrapper.text()).toContain('Alice')
  })

  it('preserves current view when selecting a ticker', async () => {
    localStorage.setItem('gmr-token', 'test-token')
    const { wrapper, router } = await mountAt('/c/AAPL/gmr-long')
    const pushSpy = vi.spyOn(router, 'push')
    await wrapper.findComponent({ name: 'TickerSearch' }).vm.$emit('select', 'MSFT')
    expect(pushSpy).toHaveBeenCalledWith('/c/MSFT/gmr-long')
  })
})
