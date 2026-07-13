/**
 * Tests for the unified Confluence-style report editor.
 */
import { _internal } from '../../src/api/session.js'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
vi.mock('../../src/api/geo.js', () => ({
  // plain async fn (not a vi.fn) so afterEach's restoreAllMocks can't wipe it
  fetchNutsRegions: async () => ({
    regions: [
      { code: 'PT', name: 'Portugal', level: 0 },
      { code: 'PT1', name: 'Continente', level: 1 },
    ],
  }),
}))
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

async function mountEditor({ content_doc = null, sections = [], reportId = 'r1', reportExtra = {} } = {}) {
  vi.spyOn(communityApi, 'getReport').mockResolvedValue({
    id: reportId,
    title: 'Test Report',
    abstract: 'Test abstract',
    visibility: 'private',
    content_doc,
    sections,
    ...reportExtra,
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

  it('insert-widget modal lists this investigation\'s visualizations (dual-source)', async () => {
    vi.spyOn(communityApi, 'listVisualizations').mockResolvedValue([
      { id: 'v1', name: 'Cohesion chart', widget_type: 'chart_snapshot', config: { entityId: 'CZ' } },
    ])
    const { wrapper } = await mountEditor({ reportId: 'r1', reportExtra: { investigation_id: 'inv1' } })

    await wrapper.find('[data-testid="tb-widget"]').trigger('click')
    await flushPromises()
    // the investigation's saved viz appear as an insert source alongside the pocket
    expect(communityApi.listVisualizations).toHaveBeenCalledWith('inv1')
    expect(wrapper.find('[data-testid="inv-viz-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="inv-viz-item-v1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Cohesion chart')
  })

  it('add-to-investigation picker lists writable investigations and adds the story', async () => {
    vi.spyOn(communityApi, 'listInvestigations').mockResolvedValue([
      { id: 'inv-w', name: 'Writable', membership: { role: 'owner' } },
      { id: 'inv-v', name: 'ViewerOnly', membership: { role: 'viewer' } },
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
      language: 'en',
      nuts_region: '',
    })
    expect(communityApi.saveDocument).toHaveBeenCalledWith('r1', expect.any(Object))
  })

  it('saves the selected NUTS region tag', async () => {
    const { wrapper } = await mountEditor({ reportId: 'r1', reportExtra: { nuts_region: '' } })
    await flushPromises()
    await flushPromises()
    const l0 = wrapper.find('[data-testid="nuts-l0"]')
    expect(l0.exists()).toBe(true)
    expect(l0.text()).toContain('Portugal')   // regions loaded from the mock
    await l0.setValue('PT')
    await flushPromises()
    await wrapper.find('[data-testid="save-story"]').trigger('click')
    await flushPromises()
    expect(communityApi.updateReport).toHaveBeenCalledWith(
      'r1', expect.objectContaining({ nuts_region: 'PT' }),
    )
  })

  it('preloads an existing region tag from the report', async () => {
    const { wrapper } = await mountEditor({ reportId: 'r1', reportExtra: { nuts_region: 'PT1' } })
    await flushPromises()
    await flushPromises()
    // options loaded from the mock, cascade reconstructed from the stored code
    const l0 = wrapper.find('[data-testid="nuts-l0"]')
    expect(l0.text()).toContain('Portugal')
    expect(l0.element.value).toBe('PT')
    // level 1 reconstructed to the stored PT1
    expect(wrapper.find('[data-testid="nuts-l1"]').element.value).toBe('PT1')
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
