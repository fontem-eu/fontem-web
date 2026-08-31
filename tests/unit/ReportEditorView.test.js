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
import { useAssistantContext } from '../../src/composables/useAssistantContext.js'

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
    // The revision the buffer is built from; every save names it back.
    head_revision: 'rev-loaded',
    sections,
    ...reportExtra,
  })
  vi.spyOn(communityApi, 'updateReport').mockResolvedValue({})
  vi.spyOn(communityApi, 'saveDocument').mockResolvedValue({ ok: true })
  vi.spyOn(communityApi, 'setStoryTags').mockResolvedValue({ tags: [] })
  // The primary action saves the draft and then opens the change review:
  // saving no longer publishes, so the thing you press leads to the diff.
  vi.spyOn(communityApi, 'openReview').mockResolvedValue({ id: 'review-1' })
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
    await wrapper.find('[data-testid="review-story"]').trigger('click')
    await flushPromises()

    expect(communityApi.updateReport).toHaveBeenCalledWith('r1', {
      title: 'Test Report',
      abstract: 'Test abstract',
      visibility: 'private',
      language: 'en',
      nuts_region: '',
    })
    // Third argument: the revision this buffer was loaded from. Saving
    // without it is what let a stale buffer overwrite newer work.
    // (Reached through Review, which saves before showing the diff.)
    // Third argument: the revision this buffer was loaded from. Saving
    // without it is what let a stale buffer overwrite newer work.
    // (Reached through Review, which saves before showing the diff.)
    expect(communityApi.saveDocument).toHaveBeenCalledWith(
      'r1', expect.any(Object), 'rev-loaded',
    )
  })

  it('saves the selected country region', async () => {
    const { wrapper } = await mountEditor({ reportId: 'r1', reportExtra: { nuts_region: '' } })
    await flushPromises()
    await flushPromises()
    const sel = wrapper.find('[data-testid="country-region-select"]')
    expect(sel.exists()).toBe(true)
    expect(sel.text()).toContain('Portugal')   // level-0 countries from the mock
    await sel.setValue('PT')
    await flushPromises()
    await wrapper.find('[data-testid="review-story"]').trigger('click')
    await flushPromises()
    expect(communityApi.updateReport).toHaveBeenCalledWith(
      'r1', expect.objectContaining({ nuts_region: 'PT' }),
    )
  })

  it('collapses a legacy deep region code to its country and saves the country', async () => {
    const { wrapper } = await mountEditor({ reportId: 'r1', reportExtra: { nuts_region: 'PT1' } })
    await flushPromises()
    await flushPromises()
    // the stored deep code PT1 collapses to the country Portugal (PT)
    const sel = wrapper.find('[data-testid="country-region-select"]')
    expect(sel.text()).toContain('Portugal')
    expect(sel.element.value).toBe('PT')
    // and the collapsed country is what gets persisted on next save
    await wrapper.find('[data-testid="review-story"]').trigger('click')
    await flushPromises()
    expect(communityApi.updateReport).toHaveBeenCalledWith(
      'r1', expect.objectContaining({ nuts_region: 'PT' }),
    )
  })

  it('toggles the mobile header kebab menu open and closed', async () => {
    const { wrapper } = await mountEditor()
    const secondary = wrapper.find('[data-testid="header-secondary"]')
    expect(secondary.exists()).toBe(true)
    expect(secondary.classes()).not.toContain('open')
    await wrapper.find('[data-testid="header-kebab"]').trigger('click')
    expect(secondary.classes()).toContain('open')
    await wrapper.find('[data-testid="header-kebab"]').trigger('click')
    expect(secondary.classes()).not.toContain('open')
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

describe('ReportEditorView — a document that moved on', () => {
  /**
   * The lost-widgets bug (prod, 2026-08-30): an assistant's edits were
   * saved from one buffer, and a save from an older buffer an hour later
   * silently replaced them. The server now refuses that save; this is the
   * editor holding up its end.
   */
  it('warns instead of overwriting, and keeps the unsaved buffer', async () => {
    const { wrapper } = await mountEditor()
    const stale = new Error('HTTP 409: conflict')
    stale.status = 409
    stale.body = {
      detail: 'the document changed since you loaded it',
      current_revision: 'rev-newer',
      current_doc: { type: 'doc', content: [] },
    }
    communityApi.saveDocument.mockRejectedValueOnce(stale)

    await wrapper.find('[data-testid="review-story"]').trigger('click')
    await flushPromises()

    const bar = wrapper.find('[data-testid="editor-stale"]')
    expect(bar.exists()).toBe(true)
    expect(bar.text()).toContain('changed')
    // Nothing was overwritten, and the reload is offered rather than taken.
    expect(wrapper.find('[data-testid="editor-stale-reload"]').exists()).toBe(true)
    expect(communityApi.getReport).toHaveBeenCalledTimes(1)
  })

  it('reloads the current document only when asked', async () => {
    const { wrapper } = await mountEditor()
    const stale = new Error('HTTP 409: conflict')
    stale.status = 409
    stale.body = { detail: 'moved on', current_revision: 'rev-newer' }
    communityApi.saveDocument.mockRejectedValueOnce(stale)

    await wrapper.find('[data-testid="review-story"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="editor-stale-reload"]').trigger('click')
    await flushPromises()

    expect(communityApi.getReport).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="editor-stale"]').exists()).toBe(false)
  })
})

describe('ReportEditorView — Review is the primary action', () => {
  it('saves the draft and opens the change review', async () => {
    const { wrapper } = await mountEditor()
    await wrapper.find('[data-testid="review-story"]').trigger('click')
    await flushPromises()

    expect(communityApi.saveDocument).toHaveBeenCalled()
    expect(communityApi.openReview).toHaveBeenCalledWith('r1', 'change')
  })

  it('keeps a Save that persists the draft without leaving the editor', async () => {
    // There is no autosave: removing Save would leave no way to put work
    // down mid-paragraph without a trip through the diff.
    const { wrapper } = await mountEditor()
    await wrapper.find('[data-testid="save-story"]').trigger('click')
    await flushPromises()

    expect(communityApi.saveDocument).toHaveBeenCalled()
    expect(communityApi.openReview).not.toHaveBeenCalled()
  })

  it('does not open an empty review when the draft matches what is published', async () => {
    const { wrapper } = await mountEditor()
    const nothing = new Error('HTTP 400: Your draft matches the published text.')
    nothing.status = 400
    communityApi.openReview.mockRejectedValueOnce(nothing)

    await wrapper.find('[data-testid="review-story"]').trigger('click')
    await flushPromises()
    // Said quietly, not as a red error bar.
    expect(wrapper.find('[data-testid="editor-error"]').exists()).toBe(false)
  })
})

describe('ReportEditorView — the assistant is a visible committer', () => {
  /**
   * Where this whole design started: an assistant edit landed somewhere
   * the author was not looking, and a later save wiped it. An edit
   * committed under its own name is one you can find in the history,
   * read as a diff, and undo.
   */
  it('commits an applied assistant edit as the assistant', async () => {
    await mountEditor()
    // The panel lives in the app shell; the editor registers the handler
    // it calls when a proposal is applied.
    const { handlers } = useAssistantContext()
    await handlers.value.applied({
      action: 'replace_body',
      category: 'content',
      params: { content: '<p>rewritten by the assistant</p>' },
    })
    await flushPromises()

    expect(communityApi.saveDocument).toHaveBeenCalledWith(
      'r1', expect.any(Object), 'rev-loaded', 'assistant',
    )
  })

  it("does not label the author's own save as the assistant's", async () => {
    const { wrapper } = await mountEditor()
    await wrapper.find('[data-testid="save-story"]').trigger('click')
    await flushPromises()

    const call = communityApi.saveDocument.mock.calls.at(-1)
    expect(call[3] ?? 'human').toBe('human')
  })
})

describe('ReportEditorView — the draft is what you edit', () => {
  /**
   * Saves go to the draft branch, so the baseline a save names has to be
   * the DRAFT's head. Naming main's head made every save after the first
   * 409 against a draft that had already moved past it — refused
   * silently, with the button re-enabling as though it had worked. The
   * e2e suite caught it as 17 rejected saves in half an hour.
   */
  it('names the draft head, not the published one, when a draft exists', async () => {
    const { wrapper } = await mountEditor({
      reportExtra: {
        head_revision: 'rev-published',
        draft_revision: 'rev-draft',
        draft_doc: { version: 2, tiptap: { type: 'doc', content: [] } },
      },
    })
    await wrapper.find('[data-testid="save-story"]').trigger('click')
    await flushPromises()

    expect(communityApi.saveDocument).toHaveBeenCalledWith(
      'r1', expect.any(Object), 'rev-draft',
    )
  })

  it('falls back to the published head before a draft exists', async () => {
    const { wrapper } = await mountEditor({
      reportExtra: { head_revision: 'rev-published', draft_revision: null },
    })
    await wrapper.find('[data-testid="save-story"]').trigger('click')
    await flushPromises()

    expect(communityApi.saveDocument).toHaveBeenCalledWith(
      'r1', expect.any(Object), 'rev-published',
    )
  })
})
