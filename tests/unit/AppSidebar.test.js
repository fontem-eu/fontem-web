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

/** The nav's entries, split into the groups the rail draws rules between. */
function groupsOf(wrapper) {
  const groups = [[]]
  for (const el of wrapper.find('[data-testid="app-nav"]').element.children) {
    if (el.tagName === 'HR') groups.push([])
    else if (el.dataset?.testid?.startsWith('nav-')) groups.at(-1).push(el.dataset.testid.slice(4))
  }
  return groups
}

describe('AppSidebar (nav rail)', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear() })
  afterEach(() => { _internal.clearForTests(); localStorage.clear() })

  it('renders Feed/Petitions/Atlas, then Data Stats/Dashboards, for anonymous visitors (contribution section hidden)', async () => {
    const { wrapper } = await mountAt('/')
    const nav = wrapper.find('[data-testid="app-nav"]')
    expect(nav.exists()).toBe(true)
    expect(nav.text()).toContain('Feed')
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
    const groups = groupsOf(wrapper)
    expect(groups).toHaveLength(3)
    expect(groups[2].slice(0, 2)).toEqual(['studio', 'my-reports'])
  })

  it('puts Atlas beside Feed and Petitions, where the things you go to look at are', async () => {
    const { wrapper } = await mountAt('/')
    const [reading, data] = groupsOf(wrapper)
    expect(reading).toEqual(['feed', 'petitions', 'atlas'])
    expect(data).toEqual(['data-stats', 'dashboards'])
  })

  it('does not repeat the logo directly under the header one', async () => {
    // The header shows the mark a few pixels above. Repeating it as the
    // first thing in the rail reads as a mistake rather than as branding,
    // so expanded the rail head carries the wordmark alone.
    const { wrapper } = await mountAt('/')
    const head = wrapper.find('[data-testid="rail-home"]')
    expect(head.exists()).toBe(true)
    expect(head.findComponent({ name: 'MosaicMark' }).exists()).toBe(false)
    expect(head.findComponent({ name: 'Wordmark' }).exists()).toBe(true)
  })

  it('marks Data Stats active on /explore', async () => {
    const { wrapper } = await mountAt('/explore')
    expect(wrapper.find('[data-testid="nav-data-stats"]').classes()).toContain('active')
  })

  it('has one Feed entry, not separate Stories and Briefings entries, signed in or out', async () => {
    // Feed, Stories and Briefings were three entries over one stream;
    // stories-only and briefings-only are filters inside the feed now.
    for (const signedIn of [false, true]) {
      if (signedIn) _internal.setAccessToken('test-token')
      const { wrapper } = await mountAt('/')
      expect(wrapper.find('[data-testid="nav-feed"]').attributes('href')).toBe('/')
      expect(wrapper.find('[data-testid="nav-stories"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="nav-briefings"]').exists()).toBe(false)
      wrapper.unmount()
    }
  })

  it('keeps Feed active while a filter is applied', async () => {
    const { wrapper } = await mountAt('/?show=stories')
    expect(wrapper.find('[data-testid="nav-feed"]').classes()).toContain('active')
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

// ── briefings: reading is the feed, the editor configures ────────────
//
// Briefings used to have two entries with backwards-reading names: the
// reading stream (/my-briefings) and the subscription editor (/briefings).
// The reading stream is a view of the feed now (?show=briefings), so only
// the editor is left, and it belongs with the things you configure about
// your own account. These pin destinations, not labels.
describe('AppSidebar — briefings placement', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear() })
  afterEach(() => { _internal.clearForTests(); localStorage.clear() })

  // Reading briefings is a filter of the feed now (?show=briefings), so
  // the only briefings entry left is the one for managing them.
  it('puts the subscription EDITOR with the account-level entries', async () => {
    _internal.setAccessToken('test-token')
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="nav-my-briefings"]').attributes('href')).toBe('/briefings')
    expect(groupsOf(wrapper)[2]).toContain('my-briefings')
  })

  it('has no separate entry for reading briefings', async () => {
    _internal.setAccessToken('test-token')
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="nav-briefings"]').exists()).toBe(false)
  })

  it('hides the subscription editor from signed-out visitors', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="nav-my-briefings"]').exists()).toBe(false)
  })
})
