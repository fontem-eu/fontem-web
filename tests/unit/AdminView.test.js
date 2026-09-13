/**
 * AdminView — the admin hub shows the user directory card to administrators
 * only. It is a hint, not the gate (the server refuses everyone else), but a
 * moderator reaches this hub too and should not be offered a page that will
 * only refuse them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/session.js', async () => {
  const { ref } = await import('vue')
  return { currentUser: ref(null) }
})

import { currentUser } from '../../src/api/session.js'
import AdminView from '../../src/views/AdminView.vue'

async function mountHub() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:rest(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/admin')
  await router.isReady()
  return mount(AdminView, {
    global: { plugins: [router, makeTestI18n()], stubs: { ThemeToggle: true } },
  })
}

const offersDirectory = (wrapper) => wrapper.findAll('a').some((a) => a.attributes('href') === '/admin/users')

beforeEach(() => {
  currentUser.value = null
})

describe('AdminView — the user directory card', () => {
  it('is offered to an administrator', async () => {
    currentUser.value = { trust_level: 'admin' }
    expect(offersDirectory(await mountHub())).toBe(true)
  })

  it('is offered to an explicit admin role', async () => {
    currentUser.value = { trust_level: 'contributor', roles: ['admin'] }
    expect(offersDirectory(await mountHub())).toBe(true)
  })

  it('is not offered to a moderator, who can still use the rest of the hub', async () => {
    currentUser.value = { trust_level: 'moderator' }
    const wrapper = await mountHub()
    expect(offersDirectory(wrapper)).toBe(false)
    expect(wrapper.findAll('a').some((a) => a.attributes('href') === '/admin/moderation')).toBe(true)
  })
})
