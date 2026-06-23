import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  listInvestigations: vi.fn(),
  createInvestigation: vi.fn(),
}))

import InvestigationsView from '../../src/views/InvestigationsView.vue'
import { listInvestigations, createInvestigation } from '../../src/api/community.js'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/investigations', component: InvestigationsView },
      { path: '/investigations/:id', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  await router.push('/investigations')
  await router.isReady()
  const w = mount(InvestigationsView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return { w, router }
}

beforeEach(() => {
  listInvestigations.mockReset()
  createInvestigation.mockReset()
})

describe('InvestigationsView', () => {
  it('lists investigations with the caller role', async () => {
    listInvestigations.mockResolvedValue([
      { id: 'i1', name: 'Panama', description: 'leaks', membership: { is_owner: true } },
    ])
    const { w } = await mountView()
    expect(w.find('[data-testid="investigation-list"]').exists()).toBe(true)
    expect(w.text()).toContain('Panama')
    expect(w.find('[data-testid="investigation-role"]').text()).toBe('Owner')
  })

  it('shows empty state when none', async () => {
    listInvestigations.mockResolvedValue([])
    const { w } = await mountView()
    expect(w.find('[data-testid="investigations-empty"]').exists()).toBe(true)
  })

  it('creates an investigation and navigates to it', async () => {
    listInvestigations.mockResolvedValue([])
    createInvestigation.mockResolvedValue({ id: 'new1', name: 'New One' })
    const { w, router } = await mountView()
    await w.find('[data-testid="new-investigation-btn"]').trigger('click')
    await w.find('[data-testid="investigation-name-input"]').setValue('New One')
    await w.find('[data-testid="create-investigation-confirm"]').trigger('click')
    await flushPromises()
    expect(createInvestigation).toHaveBeenCalledWith('New One', '')
    expect(router.currentRoute.value.path).toBe('/investigations/new1')
  })
})
