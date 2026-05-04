/**
 * Tests for the unified Confluence-style report editor.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ReportEditorView from '../../src/views/ReportEditorView.vue'
import * as communityApi from '../../src/api/community.js'

function makeRouter(reportId = 'r1') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/reports/:id/edit', component: ReportEditorView },
      { path: '/reports', component: { template: '<div />' } },
    ],
  })
  router.push(`/reports/${reportId}/edit`)
  return router
}

async function mountEditor({ content_doc = null, sections = [], reportId = 'r1' } = {}) {
  vi.spyOn(communityApi, 'getReport').mockResolvedValue({
    id: reportId,
    title: 'Test Report',
    abstract: 'Test abstract',
    visibility: 'private',
    content_doc,
    sections,
  })
  vi.spyOn(communityApi, 'updateReport').mockResolvedValue({})
  vi.spyOn(communityApi, 'saveDocument').mockResolvedValue({ ok: true })
  vi.spyOn(communityApi, 'uploadImage').mockResolvedValue({ url: '/uploads/test.png' })

  const router = makeRouter(reportId)
  await router.isReady()
  const wrapper = mount(ReportEditorView, {
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('ReportEditorView — unified editor', () => {
  beforeEach(() => {
    localStorage.setItem('gmr-token', 'test-token')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('mounts and shows title input', async () => {
    const { wrapper } = await mountEditor()
    expect(wrapper.find('[data-testid="story-title-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="story-title-input"]').element.value).toBe('Test Report')
  })

  it('shows abstract input', async () => {
    const { wrapper } = await mountEditor()
    expect(wrapper.find('[data-testid="story-abstract-input"]').exists()).toBe(true)
  })

  it('renders the TipTap editor body', async () => {
    const { wrapper } = await mountEditor()
    expect(wrapper.find('[data-testid="editor-body"]').exists()).toBe(true)
  })

  it('does not show section controls (no add/remove/markdown toggle)', async () => {
    const { wrapper } = await mountEditor()
    expect(wrapper.find('[data-testid="add-section-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="remove-section-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="toggle-markdown-btn"]').exists()).toBe(false)
  })

  it('save calls saveDocument with TipTap JSON', async () => {
    const { wrapper } = await mountEditor()
    await wrapper.find('[data-testid="save-story"]').trigger('click')
    await flushPromises()

    expect(communityApi.updateReport).toHaveBeenCalledWith('r1', {
      title: 'Test Report',
      abstract: 'Test abstract',
      visibility: 'private',
    })
    expect(communityApi.saveDocument).toHaveBeenCalledWith('r1', expect.any(Object))
  })

  it('loads v1 reports (section HTML concatenated)', async () => {
    const { wrapper } = await mountEditor({
      sections: [
        { id: 's1', content: '<p>Section one</p>' },
        { id: 's2', content: '<p>Section two</p>' },
      ],
    })
    expect(wrapper.find('[data-testid="editor-body"]').exists()).toBe(true)
  })

  it('loads v2 reports (TipTap JSON)', async () => {
    const { wrapper } = await mountEditor({
      content_doc: {
        version: 2,
        tiptap: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello v2' }] }] },
      },
    })
    expect(wrapper.find('[data-testid="editor-body"]').exists()).toBe(true)
  })
})
