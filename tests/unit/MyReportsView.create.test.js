import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  listReports: vi.fn(() => Promise.resolve([])),
  createReport: vi.fn(),
  listDossiers: vi.fn(),
  createDossier: vi.fn(),
}))

import MyReportsView from '../../src/views/MyReportsView.vue'
import { listReports, listDossiers, createDossier } from '../../src/api/community.js'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/my-stories', component: MyReportsView },
      { path: '/dossiers/:id', component: { template: '<div />' } },
      { path: '/', component: { template: '<div />' } },
    ],
  })
}
async function mountView() {
  const router = makeRouter()
  await router.push('/my-stories')
  await router.isReady()
  const w = mount(MyReportsView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return { w, router }
}

beforeEach(() => { listReports.mockReset(); listReports.mockResolvedValue([]); listDossiers.mockReset(); createDossier.mockReset() })

describe('MyReportsView — Create split + dossiers', () => {
  it('Create reveals Story + Dossier options', async () => {
    listDossiers.mockResolvedValue([])
    const { w } = await mountView()
    expect(w.find('[data-testid="create-menu"]').exists()).toBe(false)
    await w.find('[data-testid="create-btn"]').trigger('click')
    expect(w.find('[data-testid="new-story-btn"]').exists()).toBe(true)
    expect(w.find('[data-testid="new-dossier-btn"]').exists()).toBe(true)
  })

  it('lists dossiers alongside stories', async () => {
    listDossiers.mockResolvedValue([{ id: 'd1', name: 'My Dossier' }])
    const { w } = await mountView()
    expect(w.find('[data-testid="dossier-list"]').exists()).toBe(true)
    expect(w.find('[data-testid="dossier-card-d1"]').exists()).toBe(true)
    expect(w.text()).toContain('My Dossier')
  })

  it('shows BOTH stories and dossiers when both exist (STORY-14 regression)', async () => {
    listReports.mockResolvedValue([{ id: 'r1', title: 'My Story', visibility: 'private' }])
    listDossiers.mockResolvedValue([{ id: 'd1', name: 'My Dossier' }])
    const { w } = await mountView()
    // The stories list must not be hidden just because a dossier exists.
    expect(w.find('[data-testid="story-cards"]').exists()).toBe(true)
    expect(w.text()).toContain('My Story')
    expect(w.find('[data-testid="dossier-list"]').exists()).toBe(true)
    expect(w.text()).toContain('My Dossier')
    expect(w.find('[data-testid="my-stories-empty"]').exists()).toBe(false)
  })

  it('creating a dossier navigates to it', async () => {
    listDossiers.mockResolvedValue([])
    createDossier.mockResolvedValue({ id: 'dnew' })
    const { w, router } = await mountView()
    await w.find('[data-testid="create-btn"]').trigger('click')
    await w.find('[data-testid="new-dossier-btn"]').trigger('click')
    await flushPromises()
    expect(createDossier).toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/dossiers/dnew')
  })
})
