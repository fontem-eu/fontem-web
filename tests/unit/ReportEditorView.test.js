/**
 * Tests for the unified Confluence-style report editor.
 */
import { _internal } from '../../src/api/session.js'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
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
  vi.spyOn(communityApi, 'setStoryTags').mockResolvedValue({ tags: [] })
  vi.spyOn(communityApi, 'listAllTags').mockResolvedValue({ tags: [] })
  vi.spyOn(communityApi, 'uploadImage').mockResolvedValue({ url: '/uploads/test.png' })

  const router = makeRouter(reportId)
  await router.isReady()
  const wrapper = mount(ReportEditorView, {
    global: { plugins: [router, makeTestI18n()] },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('ReportEditorView — unified editor', () => {
  beforeEach(() => {
    _internal.setAccessToken('test-token')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    _internal.clearForTests(); localStorage.clear()
  })

  it('add-to-investigation picker lists writable investigations and adds the story', async () => {
    vi.spyOn(communityApi, 'listInvestigations').mockResolvedValue([
      { id: 'inv-w', name: 'Writable', membership: { is_owner: true, can_write_stories: true } },
      { id: 'inv-v', name: 'ViewerOnly', membership: { is_owner: false, can_write_stories: false } },
    ])
    const addSpy = vi.spyOn(communityApi, 'addInvestigationStory').mockResolvedValue({ status: 'ok' })
    const { wrapper } = await mountEditor({ reportId: 'r1' })

    await wrapper.find('[data-testid="add-to-investigation-btn"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="investigation-picker"]').exists()).toBe(true)
    // only the writable investigation is offered (viewer-only filtered out)
    expect(wrapper.find('[data-testid="investigation-pick-inv-w"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="investigation-pick-inv-v"]').exists()).toBe(false)

    await wrapper.find('[data-testid="investigation-pick-inv-w"]').trigger('click')
    await flushPromises()
    expect(addSpy).toHaveBeenCalledWith('inv-w', 'r1')
    expect(wrapper.find('[data-testid="investigation-picker"]').exists()).toBe(false)
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

  // ── ChapterRail (item 4) ─────────────────────────────────────
  // The TOC shipped on the read-view; the user asked for the same
  // affordance while editing. Same component, fed by a DOM ref to
  // the EditorContent host element + a `bodyVersion` counter that
  // bumps on every TipTap `update` event. Same wire-up shape as
  // ReportView.vue line 234.
  it('mounts ChapterRail alongside the editor body', async () => {
    const { wrapper } = await mountEditor()
    const rail = wrapper.findComponent({ name: 'ChapterRail' })
    expect(rail.exists()).toBe(true)
  })

  it('passes a numeric version + a body-ref prop to ChapterRail', async () => {
    const { wrapper } = await mountEditor()
    const rail = wrapper.findComponent({ name: 'ChapterRail' })
    expect(typeof rail.props('version')).toBe('number')
    // bodyRef arrives as the resolved DOM element (template-ref
    // unwrap) after onMounted runs; before that the rail won't have
    // chapters to extract — that's fine, the version counter will
    // bump on the editor's `onCreate`/`onUpdate` hook and trigger
    // a fresh DOM walk.
    expect(rail.props('bodyRef') !== undefined).toBe(true)
  })

  it('renders the editor body inside the editor-body-col wrapper', async () => {
    // The two-column layout (editor + rail) wraps the EditorContent
    // in a `.editor-body-col` div that ChapterRail walks for h2/h3.
    // Pin the structural contract so a future refactor can't move
    // the rail out into a global sidebar without also touching this
    // test.
    const { wrapper } = await mountEditor()
    const col = wrapper.find('.editor-body-col')
    expect(col.exists()).toBe(true)
    expect(col.find('.tiptap-editor').exists()).toBe(true)
  })
})
