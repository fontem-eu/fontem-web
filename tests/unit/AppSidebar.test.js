import { _internal } from '../../src/api/session.js'
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
import AppSidebar from '../../src/components/AppSidebar.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/stories-feed', '/petitions', '/spending', '/map', '/explore', '/data-quality', '/my-stories', '/my-reviews', '/briefings', '/my-briefings', '/account', '/studio', '/studio/p/:projectId'].map((p) => ({ path: p, component: { template: '<div />' } })),
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

  it('renders Stories/Petitions/Data Stats/Atlas for anonymous visitors (contribution section hidden)', async () => {
    const { wrapper } = await mountAt('/')
    const nav = wrapper.find('[data-testid="app-nav"]')
    expect(nav.exists()).toBe(true)
    expect(nav.text()).toContain('Stories')
    expect(nav.text()).toContain('Petitions')
    expect(nav.text()).toContain('Data Stats')
    expect(nav.text()).toContain('Atlas')
    // Spending dropped; contribution section (Studio, My Stories) is login-only
    expect(nav.text()).not.toContain('Spending')
    expect(wrapper.find('[data-testid="nav-data-stats"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="nav-studio"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="nav-my-reports"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="nav-atlas"]').attributes('href')).toBe('/map')
    // Dashboards selector lives in the data group
    expect(wrapper.find('[data-testid="nav-dashboards"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="nav-dashboards"]').attributes('href')).toBe('/data-quality')
  })

  it('shows the contribution section (Studio, My Stories) when authenticated, after the data group', async () => {
    _internal.setAccessToken('test-token')
    const { wrapper } = await mountAt('/')
    const ids = wrapper.findAll('[data-testid^="nav-"]').map((t) => t.attributes('data-testid'))
    const atlasIdx = ids.indexOf('nav-atlas'); const studioIdx = ids.indexOf('nav-studio'); const myIdx = ids.indexOf('nav-my-reports')
    expect(atlasIdx).toBeGreaterThanOrEqual(0)
    expect(studioIdx).toBeGreaterThan(atlasIdx)
    expect(myIdx).toBeGreaterThan(studioIdx)
  })

  it('marks Data Stats active on /explore', async () => {
    const { wrapper } = await mountAt('/explore')
    expect(wrapper.find('[data-testid="nav-data-stats"]').classes()).toContain('active')
  })

  it('Stories links to the stories-only feed, not the mixed landing', async () => {
    // The Stories entry used to point at `/`, which is the mixed feed —
    // so clicking Stories showed briefings too.
    const { wrapper } = await mountAt('/')
    const stories = wrapper.find('[data-testid="nav-stories"]')
    expect(stories.attributes('href')).toBe('/stories-feed')
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

  it('reveals the Data Studio navigator on /studio routes (authed)', async () => {
    _internal.setAccessToken('test-token')
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
// ── briefings: the feed reads, the editor configures ─────────────────
//
// The two paths read backwards from their names, and the rail had them
// placed by name rather than by what they do:
//   /my-briefings is the READING surface — everything across the
//     briefings you watch, newest first.
//   /briefings is the SUBSCRIPTION EDITOR — what you get and what else
//     you could get.
// So the feed belongs beside Stories (the other feed) and the editor
// belongs with the things you configure about your own account. These
// pin the destinations, not the labels, because the labels are the part
// that was misleading.
describe('AppSidebar — briefings placement', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear() })
  afterEach(() => { _internal.clearForTests(); localStorage.clear() })

  it('puts the briefings FEED beside Stories, not the editor', async () => {
    _internal.setAccessToken('test-token')
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="nav-briefings"]').attributes('href')).toBe('/my-briefings')
  })

  it('puts the subscription EDITOR with the account-level entries', async () => {
    _internal.setAccessToken('test-token')
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="nav-my-briefings"]').attributes('href')).toBe('/briefings')
  })

  it('orders the feed immediately after Stories', async () => {
    _internal.setAccessToken('test-token')
    const { wrapper } = await mountAt('/')
    const ids = wrapper.findAll('[data-testid^="nav-"]').map((t) => t.attributes('data-testid'))
    expect(ids.indexOf('nav-briefings')).toBe(ids.indexOf('nav-stories') + 1)
  })

  it('hides the gated feed from signed-out visitors rather than offering a bounce', async () => {
    // /my-briefings requires auth; a visible link would land on /login.
    // Remove this when the signed-out feed ships with public defaults.
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="nav-briefings"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="nav-my-briefings"]').exists()).toBe(false)
  })
})
