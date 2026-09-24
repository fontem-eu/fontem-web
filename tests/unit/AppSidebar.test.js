import { _internal } from '../../src/api/session.js'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
// Signed in, the rail mounts the Studio tree on every page, and the tree
// loads your projects. Keep that off the network.
vi.mock('../../src/api/studio.js', async () => (await import('./helpers/studioApiMock.js')).makeStudioApiMock())
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

  it('shows one section to anonymous visitors: Feed, Petitions, Atlas, Dashboards', async () => {
    const { wrapper } = await mountAt('/')
    expect(groupsOf(wrapper)).toEqual([['feed', 'petitions', 'atlas', 'dashboards']])
    expect(wrapper.find('[data-testid="nav-atlas"]').attributes('href')).toBe('/map')
    expect(wrapper.find('[data-testid="nav-dashboards"]').attributes('href')).toBe('/data-quality')
    // Spending and Stats are gone; Studio and the contribution entries
    // are signed-in only.
    expect(wrapper.find('[data-testid="app-nav"]').text()).not.toContain('Spending')
    expect(wrapper.find('[data-testid="nav-data-stats"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="nav-studio"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="nav-my-reports"]').exists()).toBe(false)
  })

  it('gives Data Studio a section of its own when signed in, before the contribution entries', async () => {
    _internal.setAccessToken('test-token')
    const { wrapper } = await mountAt('/')
    const groups = groupsOf(wrapper)
    expect(groups).toHaveLength(3)
    expect(groups[0]).toEqual(['feed', 'petitions', 'atlas', 'dashboards'])
    expect(groups[1]).toEqual(['studio'])
    expect(groups[2].slice(0, 1)).toEqual(['my-reports'])
  })

  it('has no link to the retired Stats hub or geographic explorer', async () => {
    _internal.setAccessToken('test-token')
    const { wrapper } = await mountAt('/')
    const hrefs = wrapper.findAll('[data-testid^="nav-"]').map((a) => a.attributes('href'))
    expect(hrefs).not.toContain('/explore')
    expect(hrefs).not.toContain('/geo')
  })

  it('has no Preferences button: display settings are on /account, via the account row', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="rail-settings"]').exists()).toBe(false)
    const account = wrapper.find('[data-testid="rail-account"]')
    expect(account.attributes('href')).toBe('/account')
    // Signed out it must say the settings are there, or nobody looking
    // for a language would click a row that only says "Log in".
    expect(account.text()).toBe('Log in · Preferences')
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

  it('marks Dashboards active on /data-quality', async () => {
    const { wrapper } = await mountAt('/data-quality')
    expect(wrapper.find('[data-testid="nav-dashboards"]').classes()).toContain('active')
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

  it('shows the Data Studio navigator on every page when signed in, not only inside /studio', async () => {
    _internal.setAccessToken('test-token')
    for (const path of ['/studio', '/', '/map']) {
      const { wrapper } = await mountAt(path)
      expect(wrapper.find('[data-testid="studio-nav"]').exists()).toBe(true)
      wrapper.unmount()
    }
  })

  it('shows no Data Studio navigator to anonymous visitors', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="studio-nav"]').exists()).toBe(false)
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
