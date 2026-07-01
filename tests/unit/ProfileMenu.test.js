import { _internal } from '../../src/api/session.js'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
import * as session from '../../src/api/session.js'
import * as community from '../../src/api/community.js'
import ProfileMenu from '../../src/components/ProfileMenu.vue'

function makeRouter() {
  return createRouter({ history: createMemoryHistory(), routes: ['/', '/login', '/account', '/ai-usage', '/activity'].map((p) => ({ path: p, component: { template: '<div/>' } })) })
}
async function mountMenu() {
  const router = makeRouter(); await router.push('/'); await router.isReady()
  const w = mount(ProfileMenu, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises(); return { w, router }
}

describe('ProfileMenu', () => {
  beforeEach(() => { _internal.clearForTests(); localStorage.clear() })
  afterEach(() => { _internal.clearForTests(); localStorage.clear(); vi.restoreAllMocks() })

  it('shows only a login link when anonymous', async () => {
    const { w } = await mountMenu()
    expect(w.find('[data-testid="header-login"]').exists()).toBe(true)
    expect(w.find('[data-testid="profile-trigger"]').exists()).toBe(false)
  })
  it('shows the avatar (BM) when authenticated', async () => {
    _internal.setAccessToken('t'); _internal.setUserForTests({ name: 'Bernardo Marques', email: 'b@x.com' })
    const { w } = await mountMenu()
    expect(w.find('[data-testid="profile-trigger"]').exists()).toBe(true)
    expect(w.find('[data-testid="user-avatar-initials"]').text()).toBe('BM')
  })
  it('opens a menu with settings/AI-usage/logout + shows the user', async () => {
    _internal.setAccessToken('t'); _internal.setUserForTests({ name: 'Alice', email: 'a@b.com' })
    const { w } = await mountMenu()
    await w.find('[data-testid="profile-trigger"]').trigger('click'); await flushPromises()
    const menu = w.find('[data-testid="profile-menu"]')
    expect(menu.exists()).toBe(true)
    expect(menu.text()).toContain('Alice')
    expect(w.find('[data-testid="profile-account"]').exists()).toBe(true)
    expect(w.find('[data-testid="profile-ai-usage"]').exists()).toBe(true)
    expect(w.find('[data-testid="profile-logout"]').exists()).toBe(true)
  })
  it('sign out calls session.logout', async () => {
    _internal.setAccessToken('t'); _internal.setUserForTests({ name: 'X' })
    const spy = vi.spyOn(session, 'logout').mockResolvedValue()
    const { w } = await mountMenu()
    await w.find('[data-testid="profile-trigger"]').trigger('click'); await flushPromises()
    await w.find('[data-testid="profile-logout"]').trigger('click'); await flushPromises()
    expect(spy).toHaveBeenCalled()
  })

  it('delete-account confirms, deletes, logs out', async () => {
    _internal.setAccessToken('t'); _internal.setUserForTests({ name: 'X' })
    vi.stubGlobal('confirm', () => true)
    const del = vi.spyOn(community, 'deleteCurrentUser').mockResolvedValue()
    const out = vi.spyOn(session, 'logout').mockResolvedValue()
    const { w } = await mountMenu()
    await w.find('[data-testid="profile-trigger"]').trigger('click'); await flushPromises()
    await w.find('.pm-danger').trigger('click'); await flushPromises()
    expect(del).toHaveBeenCalled(); expect(out).toHaveBeenCalled()
  })


  it('sign-out-all confirms + calls signOutEverywhere', async () => {
    _internal.setAccessToken('t'); _internal.setUserForTests({ name: 'X' })
    vi.stubGlobal('confirm', () => true)
    const all = vi.spyOn(session, 'signOutEverywhere').mockResolvedValue()
    const { w } = await mountMenu()
    await w.find('[data-testid="profile-trigger"]').trigger('click'); await flushPromises()
    await w.findAll('[data-testid="profile-menu"] button').find((b) => /all devices/i.test(b.text())).trigger('click'); await flushPromises()
    expect(all).toHaveBeenCalled()
  })
  it('delete-AI confirms + calls deleteAssistConversations', async () => {
    _internal.setAccessToken('t'); _internal.setUserForTests({ name: 'X' })
    vi.stubGlobal('confirm', () => true)
    const ai = vi.spyOn(community, 'deleteAssistConversations').mockResolvedValue()
    const { w } = await mountMenu()
    await w.find('[data-testid="profile-trigger"]').trigger('click'); await flushPromises()
    await w.findAll('[data-testid="profile-menu"] button').find((b) => /AI conversations/i.test(b.text())).trigger('click'); await flushPromises()
    expect(ai).toHaveBeenCalled()
  })
  it('account settings navigates to /account', async () => {
    _internal.setAccessToken('t'); _internal.setUserForTests({ name: 'X' })
    const { w, router } = await mountMenu()
    const push = vi.spyOn(router, 'push')
    await w.find('[data-testid="profile-trigger"]').trigger('click'); await flushPromises()
    await w.find('[data-testid="profile-account"]').trigger('click'); await flushPromises()
    expect(push).toHaveBeenCalledWith('/account')
  })

})
