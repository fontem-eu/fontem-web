import { _internal } from '../../src/api/session.js'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
import * as session from '../../src/api/session.js'
import * as community from '../../src/api/community.js'
import AccountView from '../../src/views/AccountView.vue'

function makeRouter() {
  return createRouter({ history: createMemoryHistory(), routes: ['/', '/login', '/ai-usage', '/activity', '/privacy', '/account'].map((p) => ({ path: p, component: { template: '<div/>' } })) })
}
async function mountView() {
  const router = makeRouter(); await router.push('/account'); await router.isReady()
  const w = mount(AccountView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises(); return w
}

describe('AccountView', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear() })
  afterEach(() => { _internal.clearForTests(); localStorage.clear(); vi.restoreAllMocks() })

  it('shows a login prompt when anonymous', async () => {
    const w = await mountView()
    expect(w.find('[data-testid="account-view"]').exists()).toBe(true)
    expect(w.text().toLowerCase()).toContain('not signed in')
    expect(w.find('[data-testid="account-logout"]').exists()).toBe(false)
  })

  it('shows profile + account actions when authenticated', async () => {
    _internal.setAccessToken('t'); _internal.setUserForTests({ name: 'Bernardo Marques', email: 'b@x.com' })
    const w = await mountView()
    expect(w.text()).toContain('Bernardo Marques')
    expect(w.text()).toContain('b@x.com')
    expect(w.find('[data-testid="account-logout"]').exists()).toBe(true)
  })

  it('theme toggle is clickable', async () => {
    const w = await mountView()
    await w.find('[data-testid="account-theme"]').trigger('click')
    expect(w.find('[data-testid="account-theme"]').exists()).toBe(true)
  })

  it('sign-out calls session.logout', async () => {
    _internal.setAccessToken('t'); _internal.setUserForTests({ name: 'X' })
    const spy = vi.spyOn(session, 'logout').mockResolvedValue()
    const w = await mountView()
    await w.find('[data-testid="account-logout"]').trigger('click'); await flushPromises()
    expect(spy).toHaveBeenCalled()
  })

  it('delete-account confirms, deletes, and logs out', async () => {
    _internal.setAccessToken('t'); _internal.setUserForTests({ name: 'X' })
    vi.stubGlobal('confirm', () => true)
    const del = vi.spyOn(community, 'deleteCurrentUser').mockResolvedValue()
    const out = vi.spyOn(session, 'logout').mockResolvedValue()
    const w = await mountView()
    const btns = w.findAll('.av-danger')
    await btns[0].trigger('click'); await flushPromises()
    expect(del).toHaveBeenCalled(); expect(out).toHaveBeenCalled()
  })

  it('sign-out-all + clear-AI confirm and call their APIs', async () => {
    _internal.setAccessToken('t'); _internal.setUserForTests({ name: 'X' })
    vi.stubGlobal('confirm', () => true)
    const all = vi.spyOn(session, 'signOutEverywhere').mockResolvedValue()
    const ai = vi.spyOn(community, 'deleteAssistConversations').mockResolvedValue()
    const w = await mountView()
    const rows = w.findAll('[data-testid="account-view"] button')
    // find by text
    const btnAll = rows.find((b) => /all devices/i.test(b.text()))
    const btnAi = rows.find((b) => /AI conversations/i.test(b.text()))
    await btnAll.trigger('click'); await flushPromises()
    await btnAi.trigger('click'); await flushPromises()
    expect(all).toHaveBeenCalled(); expect(ai).toHaveBeenCalled()
  })

  it('cancelling a destructive confirm does nothing', async () => {
    _internal.setAccessToken('t'); _internal.setUserForTests({ name: 'X' })
    vi.stubGlobal('confirm', () => false)
    const del = vi.spyOn(community, 'deleteCurrentUser').mockResolvedValue()
    const w = await mountView()
    await w.findAll('.av-danger')[0].trigger('click'); await flushPromises()
    expect(del).not.toHaveBeenCalled()
  })

})
