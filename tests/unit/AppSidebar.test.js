import { _internal } from '../../src/api/session.js'
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
import AppSidebar from '../../src/components/AppSidebar.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/spending', '/map', '/explore', '/my-stories', '/account', '/studio', '/studio/p/:projectId'].map((p) => ({ path: p, component: { template: '<div />' } })),
  })
}
async function mountAt(path = '/') {
  const router = makeRouter(); await router.push(path); await router.isReady()
  const wrapper = mount(AppSidebar, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return { wrapper, router }
}

describe('AppSidebar (nav rail)', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear() })
  afterEach(() => { _internal.clearForTests(); localStorage.clear() })

  it('renders the nav with Stories/Spending/Map/Explore for anonymous visitors (My Stories hidden)', async () => {
    const { wrapper } = await mountAt('/')
    const nav = wrapper.find('[data-testid="app-nav"]')
    expect(nav.exists()).toBe(true)
    expect(nav.text()).toContain('Stories')
    expect(nav.text()).toContain('Spending')
    expect(nav.text()).toContain('Map')
    expect(wrapper.find('[data-testid="nav-explore"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="nav-my-reports"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="nav-map"]').attributes('href')).toBe('/map')
  })

  it('shows My Stories when authenticated, ordered after Explore', async () => {
    _internal.setAccessToken('test-token')
    const { wrapper } = await mountAt('/')
    const ids = wrapper.findAll('[data-testid^="nav-"]').map((t) => t.attributes('data-testid'))
    const mapIdx = ids.indexOf('nav-map'); const explIdx = ids.indexOf('nav-explore'); const myIdx = ids.indexOf('nav-my-reports')
    expect(mapIdx).toBeGreaterThanOrEqual(0)
    expect(explIdx).toBeGreaterThan(mapIdx)
    expect(myIdx).toBeGreaterThan(explIdx)
  })

  it('marks Explore active on /explore', async () => {
    const { wrapper } = await mountAt('/explore')
    expect(wrapper.find('[data-testid="nav-explore"]').classes()).toContain('active')
  })

  it('marks My Stories active on /my-stories', async () => {
    _internal.setAccessToken('test-token')
    const { wrapper } = await mountAt('/my-stories')
    expect(wrapper.find('[data-testid="nav-my-reports"]').classes()).toContain('active')
  })

  it('has an account entry at the bottom + a collapse toggle', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="rail-account"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rail-collapse"]').exists()).toBe(true)
  })

  it('reveals the Data Studio navigator on /studio routes', async () => {
    const { wrapper } = await mountAt('/studio')
    expect(wrapper.find('[data-testid="studio-nav"]').exists()).toBe(true)
    // and not on other routes
    const { wrapper: home } = await mountAt('/')
    expect(home.find('[data-testid="studio-nav"]').exists()).toBe(false)
  })

  it('collapse toggle flips the collapsed rail class', async () => {
    localStorage.setItem('fontem-sidebar-collapsed', '0')
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="app-sidebar"]').classes()).not.toContain('rail--collapsed')
    await wrapper.find('[data-testid="rail-collapse"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="app-sidebar"]').classes()).toContain('rail--collapsed')
  })

})