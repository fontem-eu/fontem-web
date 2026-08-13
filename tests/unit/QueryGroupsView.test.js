import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  listQueryGroups: vi.fn(),
  createQueryGroup: vi.fn(),
  updateQueryGroup: vi.fn(),
  deleteQueryGroup: vi.fn(),
  setQueryGroupQueries: vi.fn(),
  listNamedQueries: vi.fn(),
}))

import QueryGroupsView from '../../src/views/QueryGroupsView.vue'
import {
  listQueryGroups, createQueryGroup, updateQueryGroup, deleteQueryGroup,
  setQueryGroupQueries, listNamedQueries,
} from '../../src/api/community.js'

const q = (id, name, status = 'published') => ({ id, name, slug: id, status })

function group(over = {}) {
  return {
    id: 'g1', slug: 'public-investment', name: 'Public investment', description: '',
    sort_order: 0, visibility: 'public', queries: [], ...over,
  }
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/query-groups', component: QueryGroupsView },
      { path: '/:rest(.*)', component: { template: '<div />' } },
    ],
  })
  await router.push('/admin/query-groups')
  await router.isReady()
  const w = mount(QueryGroupsView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return w
}

async function select(w) {
  await w.find('[data-testid="group-list"] button').trigger('click')
  await flushPromises()
}

const memberNames = (w) => w.find('[data-testid="members"]')
  .findAll('.qg-member-name').map((n) => n.text())

beforeEach(() => {
  vi.clearAllMocks()
  listQueryGroups.mockResolvedValue([group()])
  listNamedQueries.mockResolvedValue([q('a', 'Alpha'), q('b', 'Beta')])
})

describe('QueryGroupsView', () => {
  it('lists groups with their size and visibility', async () => {
    listQueryGroups.mockResolvedValue([
      group({ id: 'g1', name: 'Public investment', queries: [q('a', 'Alpha')] }),
      group({ id: 'g2', slug: 'staging', name: 'Staging', visibility: 'admin' }),
    ])
    const w = await mountView()
    const text = w.find('[data-testid="group-list"]').text()
    expect(text).toContain('Public investment')
    expect(text).toContain('1 queries')
    expect(text).toContain('admin')
  })

  it('offers only queries not already in the group', async () => {
    listQueryGroups.mockResolvedValue([group({ queries: [q('a', 'Alpha')] })])
    const w = await mountView()
    await select(w)
    expect(w.find('[data-testid="add-b"]').exists()).toBe(true)
    expect(w.find('[data-testid="add-a"]').exists()).toBe(false)
  })

  it('saves membership in the order shown, as a whole set', async () => {
    listQueryGroups.mockResolvedValue([group({ queries: [q('a', 'Alpha')] })])
    setQueryGroupQueries.mockResolvedValue(group())
    const w = await mountView()
    await select(w)
    await w.find('[data-testid="add-b"]').trigger('click')
    await w.find('[data-testid="save-members"]').trigger('click')
    await flushPromises()
    expect(setQueryGroupQueries).toHaveBeenCalledWith('g1', ['a', 'b'])
  })

  it('reorders within the group without touching the query itself', async () => {
    listQueryGroups.mockResolvedValue([
      group({ queries: [q('a', 'Alpha'), q('b', 'Beta')] }),
    ])
    setQueryGroupQueries.mockResolvedValue(group())
    const w = await mountView()
    await select(w)
    expect(memberNames(w)).toEqual(['Alpha', 'Beta'])

    await w.find('[data-testid="down-a"]').trigger('click')
    await flushPromises()
    expect(memberNames(w)).toEqual(['Beta', 'Alpha'])

    await w.find('[data-testid="save-members"]').trigger('click')
    await flushPromises()
    // Order lives on the membership, so nothing about the query changes.
    expect(setQueryGroupQueries).toHaveBeenCalledWith('g1', ['b', 'a'])
    expect(updateQueryGroup).not.toHaveBeenCalled()
  })

  it('cannot move the first item up or the last item down', async () => {
    listQueryGroups.mockResolvedValue([
      group({ queries: [q('a', 'Alpha'), q('b', 'Beta')] }),
    ])
    const w = await mountView()
    await select(w)
    expect(w.find('[data-testid="up-a"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="down-b"]').attributes('disabled')).toBeDefined()
  })

  it('removes a query from the group without deleting it', async () => {
    listQueryGroups.mockResolvedValue([
      group({ queries: [q('a', 'Alpha'), q('b', 'Beta')] }),
    ])
    setQueryGroupQueries.mockResolvedValue(group())
    const w = await mountView()
    await select(w)
    await w.find('[data-testid="remove-a"]').trigger('click')
    await flushPromises()
    expect(memberNames(w)).toEqual(['Beta'])
    // ...and it comes back as available rather than vanishing.
    expect(w.find('[data-testid="add-a"]').exists()).toBe(true)
  })

  it('keeps the membership save disabled until something actually moved', async () => {
    listQueryGroups.mockResolvedValue([group({ queries: [q('a', 'Alpha')] })])
    const w = await mountView()
    await select(w)
    expect(w.find('[data-testid="save-members"]').attributes('disabled')).toBeDefined()
    await w.find('[data-testid="add-b"]').trigger('click')
    expect(w.find('[data-testid="save-members"]').attributes('disabled')).toBeUndefined()
  })

  it('creates a group rather than patching the selected one', async () => {
    createQueryGroup.mockResolvedValue(group({ id: 'g9' }))
    const w = await mountView()
    await select(w)
    await w.find('[data-testid="new-group"]').trigger('click')
    await w.find('[data-testid="field-slug"]').setValue('energy')
    await w.find('[data-testid="field-visibility"]').setValue('admin')
    await w.find('[data-testid="save"]').trigger('click')
    await flushPromises()
    expect(updateQueryGroup).not.toHaveBeenCalled()
    expect(createQueryGroup.mock.calls.at(-1)[0])
      .toMatchObject({ slug: 'energy', visibility: 'admin' })
  })

  it('shows the server error instead of failing silently', async () => {
    updateQueryGroup.mockRejectedValue(new Error('HTTP 409: slug already exists'))
    const w = await mountView()
    await select(w)
    await w.find('[data-testid="save"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="error"]').text()).toContain('already exists')
  })

  it('asks before deleting a group', async () => {
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false)
    const w = await mountView()
    await select(w)
    await w.find('[data-testid="delete"]').trigger('click')
    await flushPromises()
    expect(confirmSpy).toHaveBeenCalled()
    expect(deleteQueryGroup).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
