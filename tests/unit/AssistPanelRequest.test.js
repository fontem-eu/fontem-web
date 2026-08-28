import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'

// Spread the real module first: the panel now streams through the
// session-aware streamRequest (real code, over the stubbed global
// fetch), so auth-header behaviour in these tests is the shipped
// behaviour rather than a re-implementation.
vi.mock('../../src/api/community.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getAssistConversation: vi.fn().mockResolvedValue(null),
  getAssistUsage: vi.fn().mockResolvedValue({ tokens_1h: 0, tokens_24h: 0, tokens_7d: 0 }),
}))
vi.mock('../../src/composables/useEditProposals.js', () => ({
  validateProposal: vi.fn(() => ({ valid: false })),
  executeProposal: vi.fn(),
}))

// The regression this pins: the panel never told the server an editor was
// present. The server scopes propose_edit out of the tool array unless
// has_editor is true, so the model was asked to use a tool it had never
// been given and narrated the edit instead — "the string has been added to
// the report as requested". Every layer below the request body behaved
// correctly, so the request body is the only place it is visible.
function sseOnce() {
  const enc = new TextEncoder().encode('event: done\ndata: {}\n\n')
  let sent = false
  return {
    ok: true,
    body: { getReader: () => ({ read: async () => (sent
      ? { done: true, value: undefined }
      : ((sent = true), { done: false, value: enc })) }) },
  }
}

describe('AssistPanel request body', () => {
  let fetchMock
  beforeEach(() => {
    fetchMock = vi.fn(async () => sseOnce())
    vi.stubGlobal('fetch', fetchMock)
  })

  async function sendWith(props) {
    const wrapper = mount(AssistPanel, {
      props,
      global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()
    // The panel starts closed; the toggle is what mounts the form.
    await wrapper.find('[data-testid="assist-toggle"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="assist-input"]').setValue('hello')
    // The send button is type=submit inside <form @submit.prevent>;
    // jsdom does not turn a button click into a form submit.
    await wrapper.find('form.assist-input').trigger('submit')
    await flushPromises()
    await new Promise((r) => setTimeout(r, 30))
    await flushPromises()
    const call = fetchMock.mock.calls.find(
      (c) => String(c[0]).includes('/assist/chat/stream'))
    if (!call) {
      throw new Error('no stream request; fetch calls: '
        + JSON.stringify(fetchMock.mock.calls.map((c) => String(c[0]))))
    }
    return JSON.parse(call[1].body)
  }

  it('declares has_editor when a report and editor state are present', async () => {
    const body = await sendWith({
      reportContext: 'Test Report', reportId: 'report-1',
      editorState: { doc: {} },
    })
    expect(body.has_editor).toBe(true)
  })

  it('declares has_editor false when there is nothing to propose into', async () => {
    const body = await sendWith({ reportContext: null, reportId: null, editorState: null })
    expect(body.has_editor).toBe(false)
  })
})
