/**
 * AdminUsersView — the admin user directory.
 *
 * The server decides who may see it; the page's job is to render what it is
 * given honestly: a dash where nothing was recorded rather than an invented
 * date, a refusal as a refusal rather than an error, and paging and sorting
 * that ask the server for the right slice.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  listAdminUsers: vi.fn(),
}))

import AdminUsersView from '../../src/views/AdminUsersView.vue'
import { listAdminUsers } from '../../src/api/community.js'

function account(over = {}) {
  return {
    id: 'u1',
    email: 'ada@example.eu',
    name: 'Ada',
    trust_level: 'admin',
    roles: [],
    email_verified: true,
    registered_at: '2026-01-10T09:00:00Z',
    last_login_at: '2026-09-12T08:30:00Z',
    last_seen_at: '2026-09-13T10:00:00Z',
    last_activity_at: '2026-09-11T14:00:00Z',
    activity_count: 42,
    ...over,
  }
}

function pageOf(users, total = users.length) {
  return { total, limit: 50, offset: 0, sort: 'registered', users }
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin', component: { template: '<div />' } },
      { path: '/admin/users', component: AdminUsersView },
    ],
  })
  await router.push('/admin/users')
  await router.isReady()
  const wrapper = mount(AdminUsersView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return wrapper
}

const cellsOf = (wrapper, id = 'u1') => wrapper.get(`[data-testid="admin-users-row-${id}"]`).findAll('td')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdminUsersView', () => {
  it('asks for the first page, newest registrations first', async () => {
    listAdminUsers.mockResolvedValue(pageOf([account()]))
    await mountView()
    expect(listAdminUsers).toHaveBeenCalledWith({ sort: 'registered', limit: 50, offset: 0 })
  })

  it('lists each account with its trivia', async () => {
    listAdminUsers.mockResolvedValue(pageOf([account()]))
    const wrapper = await mountView()
    const row = wrapper.get('[data-testid="admin-users-row-u1"]')
    expect(row.text()).toContain('Ada')
    expect(row.text()).toContain('ada@example.eu')
    expect(cellsOf(wrapper)[6].text()).toBe('42')
  })

  it('shows a dash, not an invented date, where nothing was recorded', async () => {
    listAdminUsers.mockResolvedValue(pageOf([account({
      last_login_at: null, last_seen_at: null, last_activity_at: null, activity_count: 0,
    })]))
    const wrapper = await mountView()
    const cells = cellsOf(wrapper)
    expect(cells[3].text()).toBe('—')
    expect(cells[4].text()).toBe('—')
    expect(cells[5].text()).toBe('—')
    // A missing login is explained: tracking began after the account last signed in.
    expect(cells[3].attributes('title')).toBeTruthy()
  })

  it('flags an unverified email', async () => {
    listAdminUsers.mockResolvedValue(pageOf([account({ email_verified: false })]))
    const wrapper = await mountView()
    expect(wrapper.find('[data-testid="admin-users-unverified"]').exists()).toBe(true)
  })

  it('shows the trust level and any role it does not already say', async () => {
    listAdminUsers.mockResolvedValue(pageOf([
      account({ trust_level: 'contributor', roles: ['moderator'] }),
    ]))
    const wrapper = await mountView()
    expect(cellsOf(wrapper)[1].text()).toBe('contributor · moderator')
  })

  it('re-sorts from the first page when a column is chosen', async () => {
    listAdminUsers.mockResolvedValue(pageOf([account()], 120))
    const wrapper = await mountView()

    await wrapper.get('[data-testid="admin-users-next"]').trigger('click')
    await flushPromises()
    expect(listAdminUsers).toHaveBeenLastCalledWith({ sort: 'registered', limit: 50, offset: 50 })

    await wrapper.get('[data-testid="admin-users-sort-last_login"]').trigger('click')
    await flushPromises()
    expect(listAdminUsers).toHaveBeenLastCalledWith({ sort: 'last_login', limit: 50, offset: 0 })
    const header = wrapper.get('[data-testid="admin-users-sort-last_login"]').element.closest('th')
    expect(header.getAttribute('aria-sort')).toBe('descending')
  })

  it('pages within the total and stops at either end', async () => {
    listAdminUsers.mockResolvedValue(pageOf([account()], 60))
    const wrapper = await mountView()
    expect(wrapper.get('[data-testid="admin-users-previous"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="admin-users-count"]').text()).toContain('1–50')

    await wrapper.get('[data-testid="admin-users-next"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="admin-users-next"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="admin-users-count"]').text()).toContain('51–60')
  })

  it('renders a refusal, not an error, when the server says no', async () => {
    listAdminUsers.mockRejectedValue(Object.assign(new Error('HTTP 403: forbidden'), { status: 403 }))
    const wrapper = await mountView()
    expect(wrapper.find('[data-testid="admin-users-refused"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="admin-users-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="admin-users-table"]').exists()).toBe(false)
  })

  it('shows any other failure as an error', async () => {
    listAdminUsers.mockRejectedValue(Object.assign(new Error('HTTP 500: boom'), { status: 500 }))
    const wrapper = await mountView()
    expect(wrapper.get('[data-testid="admin-users-error"]').text()).toContain('HTTP 500')
    expect(wrapper.find('[data-testid="admin-users-refused"]').exists()).toBe(false)
  })
})
