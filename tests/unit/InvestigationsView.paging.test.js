import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({ listInvestigations: vi.fn(), createInvestigation: vi.fn() }))

import InvestigationsView from '../../src/views/InvestigationsView.vue'
import { listInvestigations } from '../../src/api/community.js'

const inv = (i) => ({ id: `i${i}`, name: `Inv ${i}`, description: '', updated_at: `2026-09-26T12:00:${String(59 - i).padStart(2, '0')}Z`,
  membership: { role: 'owner' } })
const range = (a, b) => Array.from({ length: b - a }, (_, k) => inv(a + k))

async function mountView() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/investigations', component: InvestigationsView },
    { path: '/investigations/:id', component: { template: '<div />' } }] })
  await router.push('/investigations'); await router.isReady()
  const w = mount(InvestigationsView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return w
}

describe('InvestigationsView — ten at a time', () => {
  beforeEach(() => listInvestigations.mockReset())
  const cards = (w) => w.findAll('[data-testid^="investigation-card-"]')

  it('shows the first ten and a Show more that fetches the next page', async () => {
    listInvestigations.mockResolvedValueOnce(range(0, 10)).mockResolvedValueOnce(range(10, 13))
    const w = await mountView()
    expect(cards(w)).toHaveLength(10)
    const more = w.find('[data-testid="investigations-show-more"]')
    expect(more.exists()).toBe(true)
    await more.trigger('click'); await flushPromises()
    expect(listInvestigations).toHaveBeenLastCalledWith({ before: `${inv(9).updated_at}|i9` })
    expect(cards(w)).toHaveLength(13)
    expect(w.find('[data-testid="investigations-show-more"]').exists()).toBe(false)
  })

  it('has no Show more when the first page is the whole list', async () => {
    listInvestigations.mockResolvedValueOnce(range(0, 4))
    const w = await mountView()
    expect(cards(w)).toHaveLength(4)
    expect(w.find('[data-testid="investigations-show-more"]').exists()).toBe(false)
  })

  it('hides Show more when a full page brings nothing new', async () => {
    listInvestigations.mockResolvedValueOnce(range(0, 10)).mockResolvedValueOnce(range(0, 10))
    const w = await mountView()
    await w.find('[data-testid="investigations-show-more"]').trigger('click'); await flushPromises()
    expect(cards(w)).toHaveLength(10)
    expect(w.find('[data-testid="investigations-show-more"]').exists()).toBe(false)
  })
})
