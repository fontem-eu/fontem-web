import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  getDossier: vi.fn(),
  addDossierArticle: vi.fn(),
  removeDossierArticle: vi.fn(),
  createReport: vi.fn(),
}))

import DossierView from '../../src/views/DossierView.vue'
import { getDossier, addDossierArticle, removeDossierArticle, createReport } from '../../src/api/community.js'

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dossiers/:id', component: DossierView },
      { path: '/my-stories', component: { template: '<div />' } },
      { path: '/stories/:id/edit', component: { template: '<div />' } },
    ],
  })
  await router.push('/dossiers/d1')
  await router.isReady()
  const w = mount(DossierView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return { w, router }
}

beforeEach(() => {
  for (const m of [getDossier, addDossierArticle, removeDossierArticle, createReport]) m.mockReset()
})

describe('DossierView', () => {
  it('renders the dossier title + article tree', async () => {
    getDossier.mockResolvedValue({ id: 'd1', name: 'Files', articles: [{ id: 'a1', title: 'Root', parent_id: null }] })
    const { w } = await mountView()
    expect(w.find('[data-testid="dossier-title"]').text()).toBe('Files')
    expect(w.find('[data-testid="tree-node-a1"]').exists()).toBe(true)
  })

  it('new article creates a story and attaches it', async () => {
    getDossier.mockResolvedValueOnce({ id: 'd1', name: 'Files', articles: [] })
    createReport.mockResolvedValue({ id: 'new1', title: 'Untitled article' })
    addDossierArticle.mockResolvedValue({})
    getDossier.mockResolvedValueOnce({ id: 'd1', name: 'Files', articles: [{ id: 'new1', title: 'Untitled article', parent_id: null }] })
    const { w } = await mountView()
    await w.find('[data-testid="dossier-new-article"]').trigger('click')
    await flushPromises()
    expect(createReport).toHaveBeenCalled()
    expect(addDossierArticle).toHaveBeenCalledWith('d1', 'new1', null)
    expect(w.find('[data-testid="tree-node-new1"]').exists()).toBe(true)
  })

  it('selecting a node shows it + an open-in-editor action', async () => {
    getDossier.mockResolvedValue({ id: 'd1', name: 'Files', articles: [{ id: 'a1', title: 'Root', parent_id: null }] })
    const { w } = await mountView()
    await w.find('[data-testid="tree-select-a1"]').trigger('click')
    expect(w.find('[data-testid="dossier-selected-title"]').text()).toBe('Root')
    expect(w.find('[data-testid="dossier-edit-article"]').exists()).toBe(true)
  })

  it('removing a node detaches the article', async () => {
    getDossier.mockResolvedValueOnce({ id: 'd1', name: 'Files', articles: [{ id: 'a1', title: 'Root', parent_id: null }] })
    removeDossierArticle.mockResolvedValue({})
    getDossier.mockResolvedValueOnce({ id: 'd1', name: 'Files', articles: [] })
    const { w } = await mountView()
    await w.find('[data-testid="tree-remove-a1"]').trigger('click')
    await flushPromises()
    expect(removeDossierArticle).toHaveBeenCalledWith('d1', 'a1')
  })
})
