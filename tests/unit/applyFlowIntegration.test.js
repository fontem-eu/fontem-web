/**
 * Integration tests for the AI Assist → editor apply flow.
 *
 * These cover the end-to-end shape of "user clicks Apply on a
 * proposal":
 *   AssistPanel.applyProposal()
 *     → useEditProposals.executeProposal()
 *     → emit('applied', { action, category, params })
 *     → ReportEditorView.onProposalApplied()
 *     → saveDocument()           [for content edits]
 *       OR  title/abstract refs  [for metadata edits]
 *
 * The bug these tests guard against: AssistPanel used to emit
 * 'refresh', and the parent's @refresh handler called loadReport,
 * which destroyed the editor and rebuilt it from the server's
 * (still-old) copy of the report. Net effect: clicking Apply
 * silently erased the edit. Tests pin the new contract so we don't
 * slide back into refetch-on-apply.
 *
 * AssistPanel exposes `applyProposal` + `messages` via defineExpose
 * specifically so integration tests can drive the apply path without
 * standing up the SSE stream end-to-end (jsdom + ReadableStream
 * timing is unreliable). The full live-stream path is covered by the
 * prod smoke test (ASSIST-25).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../../src/api/community.js', () => ({
  getAssistConversation: vi.fn().mockResolvedValue(null),
  getAssistUsage: vi.fn().mockResolvedValue({
    tokens_1h: 0, tokens_24h: 0, tokens_7d: 0,
  }),
  updateReport: vi.fn().mockResolvedValue({}),
  saveDocument: vi.fn().mockResolvedValue({}),
}))

vi.mock('../../src/utils/sanitize.js', () => ({
  sanitizeHtml: vi.fn((x) => x),
  sanitizeMarkdown: vi.fn((x) => x),
}))

import AssistPanel from '../../src/components/AssistPanel.vue'
import { updateReport, saveDocument } from '../../src/api/community.js'

// ── Editor stub ────────────────────────────────────────────────────
function makeEditor() {
  const inserts = []
  const chain = {
    focus: () => chain,
    insertContent: (payload) => { inserts.push(payload); return chain },
    run: () => true,
  }
  return {
    chain: () => chain,
    inserts,
    getJSON: () => ({ type: 'doc', content: [{ inserted: inserts.length }] }),
  }
}

// Inject a proposal into the panel by writing directly to the
// exposed messages array — the same shape the live SSE pump produces.
function pushProposal(panel, proposal) {
  panel.messages.push({
    role: 'assistant',
    text: 'Here is a proposed edit.',
    proposals: [proposal],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── 1. AssistPanel apply flow ─────────────────────────────────────

describe('AssistPanel — apply flow', () => {
  it('emits `applied` with content category after a successful insert', async () => {
    const editor = makeEditor()
    const wrapper = mount(AssistPanel, {
      props: {
        reportContext: 'ctx',
        reportId: 'r-42',
        editorState: { editor, title: 'T', abstract: 'A' },
      },
    })
    await flushPromises()
    pushProposal(wrapper.vm, {
      action: 'insert_content',
      params: { content: '<p>hello from AI</p>' },
      description: 'add greeting',
    })
    await flushPromises()

    await wrapper.vm.applyProposal(wrapper.vm.messages[0].proposals[0], 0)
    await flushPromises()

    // Editor was actually mutated — the user sees the new content.
    expect(editor.inserts).toEqual(['<p>hello from AI</p>'])

    // The parent gets the action + category needed to persist.
    const applied = wrapper.emitted('applied')
    expect(applied).toBeTruthy()
    expect(applied[0][0]).toMatchObject({
      action: 'insert_content',
      category: 'content',
    })
  })

  it('does NOT emit the legacy `refresh` event (it would erase the local edit)', async () => {
    const editor = makeEditor()
    const wrapper = mount(AssistPanel, {
      props: { reportContext: 'ctx', reportId: 'r-42', editorState: { editor } },
    })
    await flushPromises()
    pushProposal(wrapper.vm, {
      action: 'insert_content',
      params: { content: '<p>x</p>' },
    })
    await wrapper.vm.applyProposal(wrapper.vm.messages[0].proposals[0], 0)
    await flushPromises()

    // The bug: emitting 'refresh' triggered loadReport on the parent,
    // which destroyed the editor and reloaded the *unsaved* server
    // state. Pinning that 'refresh' is no longer emitted by Apply.
    expect(wrapper.emitted('refresh')).toBeUndefined()
  })

  it('marks the proposal as Applied in the UI on success', async () => {
    const editor = makeEditor()
    const wrapper = mount(AssistPanel, {
      props: { reportContext: 'ctx', reportId: 'r-42', editorState: { editor } },
    })
    await flushPromises()
    await wrapper.find('[data-testid="assist-toggle"]').trigger('click')
    pushProposal(wrapper.vm, {
      action: 'insert_content',
      params: { content: '<p>x</p>' },
    })
    await flushPromises()

    await wrapper.vm.applyProposal(wrapper.vm.messages[0].proposals[0], 0)
    await flushPromises()

    expect(wrapper.find('[data-testid="proposal-applied"]').exists()).toBe(true)
  })

  it('routes update_title through updateReport and emits metadata category', async () => {
    const editor = makeEditor()
    const wrapper = mount(AssistPanel, {
      props: { reportContext: 'ctx', reportId: 'r-42', editorState: { editor } },
    })
    await flushPromises()
    pushProposal(wrapper.vm, {
      action: 'update_title',
      params: { title: 'A better title' },
    })
    await wrapper.vm.applyProposal(wrapper.vm.messages[0].proposals[0], 0)
    await flushPromises()

    expect(updateReport).toHaveBeenCalledWith('r-42', { title: 'A better title' })
    expect(wrapper.emitted('applied')[0][0]).toMatchObject({
      action: 'update_title',
      category: 'metadata',
    })
    // Editor untouched on metadata edits.
    expect(editor.inserts).toEqual([])
  })

  it('does NOT emit applied when the executor fails (e.g. no editor)', async () => {
    const wrapper = mount(AssistPanel, {
      props: { reportContext: 'ctx', reportId: 'r-42', editorState: { /* no editor */ } },
    })
    await flushPromises()
    // Open the panel so the error bar inside it actually renders into
    // the DOM (it's `v-if="open"`-gated).
    await wrapper.find('[data-testid="assist-toggle"]').trigger('click')
    pushProposal(wrapper.vm, {
      action: 'insert_content',
      params: { content: '<p>x</p>' },
    })
    await wrapper.vm.applyProposal(wrapper.vm.messages[0].proposals[0], 0)
    await flushPromises()

    expect(wrapper.emitted('applied')).toBeUndefined()
    // Surface the reason so users see *why* nothing happened.
    expect(wrapper.text()).toMatch(/Edit failed/i)
    expect(wrapper.text()).toMatch(/No editor available/i)
  })

  it('does NOT emit applied when sanitisation strips the content', async () => {
    const { sanitizeHtml } = await import('../../src/utils/sanitize.js')
    sanitizeHtml.mockReturnValueOnce('   ')

    const editor = makeEditor()
    const wrapper = mount(AssistPanel, {
      props: { reportContext: 'ctx', reportId: 'r-42', editorState: { editor } },
    })
    await flushPromises()
    await wrapper.find('[data-testid="assist-toggle"]').trigger('click')
    pushProposal(wrapper.vm, {
      action: 'insert_content',
      params: { content: '<script>bad()</script>' },
    })
    await wrapper.vm.applyProposal(wrapper.vm.messages[0].proposals[0], 0)
    await flushPromises()

    expect(editor.inserts).toEqual([])
    expect(wrapper.emitted('applied')).toBeUndefined()
    expect(wrapper.text()).toMatch(/empty after sanitisation/i)
  })
})

// ── 2. Parent handler — content auto-save + metadata mirror ──────
//
// Replicates the shape of ReportEditorView.onProposalApplied so
// behaviour is locked even without mounting the full TipTap editor
// (which is heavy + flaky in jsdom). The Vue view delegates to the
// same logic; if the shape ever drifts here, update both.

function makeOnProposalApplied(refs, editor, api) {
  return async function onProposalApplied({ action, category, params }) {
    if (category === 'metadata') {
      if (action === 'update_title' && params?.title !== undefined) {
        refs.title = params.title
      } else if (action === 'update_abstract' && params?.abstract !== undefined) {
        refs.abstract = params.abstract
      }
      return
    }
    if (category === 'content' && editor) {
      try {
        await api.saveDocument('r-42', editor.getJSON())
      } catch (err) {
        refs.error = err.message
      }
    }
  }
}

describe('ReportEditorView — onProposalApplied handler', () => {
  it('persists the editor JSON after a content edit', async () => {
    const refs = { title: 'old', abstract: 'old', error: null }
    const editor = { getJSON: () => ({ type: 'doc', content: [] }) }
    const handler = makeOnProposalApplied(refs, editor, { saveDocument })

    await handler({ action: 'insert_content', category: 'content', params: { content: '<p>x</p>' } })

    expect(saveDocument).toHaveBeenCalledWith('r-42', { type: 'doc', content: [] })
    expect(refs.error).toBe(null)
  })

  it('surfaces the error if saveDocument fails (does NOT roll back the editor)', async () => {
    saveDocument.mockRejectedValueOnce(new Error('boom'))
    const refs = { title: 'old', abstract: 'old', error: null }
    const editor = { getJSON: () => ({ type: 'doc', content: [] }) }
    const handler = makeOnProposalApplied(refs, editor, { saveDocument })

    await handler({ action: 'insert_content', category: 'content', params: { content: '<p>x</p>' } })
    expect(refs.error).toBe('boom')
  })

  it('mirrors update_title into local state without calling saveDocument', async () => {
    const refs = { title: 'old', abstract: 'old', error: null }
    const handler = makeOnProposalApplied(refs, { getJSON: () => ({}) }, { saveDocument })

    await handler({ action: 'update_title', category: 'metadata', params: { title: 'New' } })

    expect(refs.title).toBe('New')
    expect(saveDocument).not.toHaveBeenCalled()
  })

  it('mirrors update_abstract into local state without calling saveDocument', async () => {
    const refs = { title: 'old', abstract: 'old', error: null }
    const handler = makeOnProposalApplied(refs, null, { saveDocument })

    await handler({ action: 'update_abstract', category: 'metadata', params: { abstract: 'Better' } })

    expect(refs.abstract).toBe('Better')
    expect(saveDocument).not.toHaveBeenCalled()
  })
})
