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

async function mountEditor({ sections = [], reportId = 'r1' } = {}) {
  vi.spyOn(communityApi, 'getReport').mockResolvedValue({
    id: reportId,
    title: 'R',
    abstract: 'A',
    visibility: 'private',
    sections,
  })
  vi.spyOn(communityApi, 'updateReport').mockResolvedValue({})
  vi.spyOn(communityApi, 'addSection').mockImplementation(async () => ({
    id: 'new-' + Math.random().toString(36).slice(2, 8),
  }))
  vi.spyOn(communityApi, 'editSection').mockResolvedValue({})
  vi.spyOn(communityApi, 'deleteSection').mockResolvedValue(null)

  const router = makeRouter(reportId)
  await router.isReady()
  const wrapper = mount(ReportEditorView, {
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('ReportEditorView — save persists section deletions', () => {
  beforeEach(() => {
    localStorage.setItem('gmr-token', 'test-token')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('calls deleteSection for sections the user removed before saving', async () => {
    const { wrapper } = await mountEditor({
      sections: [
        { id: 'sec-1', content: '<p>First</p>' },
        { id: 'sec-2', content: '<p>Second</p>' },
        { id: 'sec-3', content: '<p>Third</p>' },
      ],
    })

    // Remove the middle section (user clicks the Remove button)
    const removeButtons = wrapper.findAll('[data-testid="remove-section-btn"]')
    expect(removeButtons).toHaveLength(3)
    await removeButtons[1].trigger('click')

    // Save
    await wrapper.find('[data-testid="save-report"]').trigger('click')
    await flushPromises()

    // The removed section must have been deleted on the server
    expect(communityApi.deleteSection).toHaveBeenCalledWith('r1', 'sec-2')

    // The surviving sections must have been updated, not the deleted one
    const editSectionCalls = communityApi.editSection.mock.calls.map((c) => c[1])
    expect(editSectionCalls).toContain('sec-1')
    expect(editSectionCalls).toContain('sec-3')
    expect(editSectionCalls).not.toContain('sec-2')
  })

  it('does not call deleteSection for freshly-added sections that were removed before save', async () => {
    const { wrapper } = await mountEditor({
      sections: [{ id: 'sec-1', content: '<p>First</p>' }],
    })

    // Add a new section, then remove it before saving
    await wrapper.find('[data-testid="add-section-btn"]').trigger('click')
    const removeButtons = wrapper.findAll('[data-testid="remove-section-btn"]')
    await removeButtons[removeButtons.length - 1].trigger('click')

    await wrapper.find('[data-testid="save-report"]').trigger('click')
    await flushPromises()

    // A new section never existed on the server, so deleteSection must not be called
    expect(communityApi.deleteSection).not.toHaveBeenCalled()
    // And the surviving original section is edited
    expect(communityApi.editSection).toHaveBeenCalledWith('r1', 'sec-1', expect.any(String))
  })

  it('deletes sections only once even if save is called multiple times', async () => {
    const { wrapper } = await mountEditor({
      sections: [
        { id: 'sec-1', content: '<p>First</p>' },
        { id: 'sec-2', content: '<p>Second</p>' },
      ],
    })

    await wrapper.findAll('[data-testid="remove-section-btn"]')[1].trigger('click')

    await wrapper.find('[data-testid="save-report"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="save-report"]').trigger('click')
    await flushPromises()

    const deleteCalls = communityApi.deleteSection.mock.calls.filter(
      (c) => c[1] === 'sec-2',
    )
    expect(deleteCalls).toHaveLength(1)
  })

  it('resets pending deletions after reloading the report', async () => {
    const { wrapper } = await mountEditor({
      sections: [
        { id: 'sec-1', content: '<p>First</p>' },
        { id: 'sec-2', content: '<p>Second</p>' },
      ],
    })

    // User removes a section but doesn't save — then the editor reloads
    // (e.g. after an AI assist refresh). The stale deletion must not leak.
    await wrapper.findAll('[data-testid="remove-section-btn"]')[1].trigger('click')

    // Simulate a reload by invoking the exposed loadReport via the refresh flow:
    // easiest path is to call the spy setup again and trigger another mount.
    // Here we just call getReport's spy and trigger save; if the deleted list
    // was leaked it would still call deleteSection on sec-2.
    // Update the mock to return both sections again (server is unchanged)
    vi.spyOn(communityApi, 'getReport').mockResolvedValue({
      id: 'r1',
      title: 'R',
      abstract: 'A',
      visibility: 'private',
      sections: [
        { id: 'sec-1', content: '<p>First</p>' },
        { id: 'sec-2', content: '<p>Second</p>' },
      ],
    })

    // Trigger a reload by emitting the refresh event from AssistPanel
    wrapper.findComponent({ name: 'AssistPanel' }).vm.$emit('refresh')
    await flushPromises()

    // Now save without removing anything
    communityApi.deleteSection.mockClear()
    await wrapper.find('[data-testid="save-report"]').trigger('click')
    await flushPromises()

    expect(communityApi.deleteSection).not.toHaveBeenCalled()
  })
})
