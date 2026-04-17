import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../../src/api/community.js', () => ({
  deleteAssistConversations: vi.fn().mockResolvedValue(null),
  deleteCurrentUser: vi.fn().mockResolvedValue(null),
}))

import ProfileDropdown from '../../src/components/ProfileDropdown.vue'
import { deleteCurrentUser } from '../../src/api/community.js'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/ai-usage', component: { template: '<div />' } },
      { path: '/privacy', component: { template: '<div />' } },
    ],
  })
}

async function mountDropdown() {
  const router = makeRouter()
  await router.push('/')
  await router.isReady()
  const wrapper = mount(ProfileDropdown, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  // Open the menu
  wrapper.find('[data-testid="profile-menu-trigger"]').trigger('click')
  await flushPromises()
  return wrapper
}

describe('ProfileDropdown — Delete account', () => {
  let originalLocation
  let confirmSpy

  beforeEach(() => {
    localStorage.setItem('gmr-token', 'fake-token')
    localStorage.setItem('gmr-user', JSON.stringify({ id: '1', name: 'Tester' }))
    localStorage.setItem('gmr-cookie-consent', 'accepted')

    // Stub window.location to capture redirects without real navigation
    originalLocation = window.location
    delete window.location
    window.location = { href: '' }

    confirmSpy = vi.spyOn(window, 'confirm')
    deleteCurrentUser.mockClear()
  })

  afterEach(() => {
    window.location = originalLocation
    confirmSpy.mockRestore()
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('shows a confirm dialog before calling the API', async () => {
    confirmSpy.mockReturnValue(false)
    const wrapper = await mountDropdown()
    await wrapper.find('[data-testid="menu-delete-account"]').trigger('click')
    await flushPromises()
    expect(confirmSpy).toHaveBeenCalled()
    expect(deleteCurrentUser).not.toHaveBeenCalled()
  })

  it('calls deleteCurrentUser, clears localStorage, and redirects on confirm', async () => {
    confirmSpy.mockReturnValue(true)
    const wrapper = await mountDropdown()
    await wrapper.find('[data-testid="menu-delete-account"]').trigger('click')
    await flushPromises()
    expect(deleteCurrentUser).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('gmr-token')).toBeNull()
    expect(localStorage.getItem('gmr-user')).toBeNull()
    expect(localStorage.getItem('gmr-cookie-consent')).toBeNull()
    expect(window.location.href).toBe('/')
  })

  it('shows error feedback when API fails and does not clear localStorage', async () => {
    confirmSpy.mockReturnValue(true)
    deleteCurrentUser.mockRejectedValueOnce(new Error('boom'))
    const wrapper = await mountDropdown()
    await wrapper.find('[data-testid="menu-delete-account"]').trigger('click')
    await flushPromises()
    expect(localStorage.getItem('gmr-token')).toBe('fake-token')
    expect(window.location.href).toBe('')
  })
})
