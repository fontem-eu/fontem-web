import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'

/**
 * What the agent did survives a reload.
 *
 * Tool calls used to exist only as SSE events. The panel drew them while the
 * turn ran and a page refresh lost the lot — so the record of what the model
 * actually did, which is the evidence, was the one thing that did not
 * persist. Production had 31 assistant messages and not one tool call.
 *
 * They are conversation rows now: the tool and its arguments, addressable by
 * the id minted where the call ran, so an activity entry can point at it. The
 * result is deliberately not stored, and the bubble says so rather than
 * showing an empty box that reads like the tool returned nothing.
 */
const conversation = vi.fn()
vi.mock('../../src/api/community.js', () => ({
  getAssistConversation: vi.fn().mockResolvedValue(null),
  getAssistConversationPage: (...a) => conversation(...a),
  getAssistUsage: vi.fn().mockResolvedValue({ tokens_1h: 0, tokens_24h: 0, tokens_7d: 0 }),
}))
vi.mock('../../src/composables/useEditProposals.js', () => ({
  validateProposal: vi.fn(() => ({ valid: true })),
  executeProposal: vi.fn().mockResolvedValue({ ok: true }),
}))

const STORED = {
  conversation_key: 'global',
  messages: [
    { id: 'm1', role: 'user', content: 'who supplies Russia?', created_at: '2026-08-13T10:00:00Z', extras: {} },
    {
      id: 'call-abc',
      role: 'tool',
      content: 'mcp__gmr__search_entities',
      created_at: '2026-08-13T10:00:01Z',
      extras: { args: { query: 'Russia' }, bytes: 1557, truncated: false, elapsed: 0.4 },
    },
    { id: 'm3', role: 'assistant', content: 'Found 7.', created_at: '2026-08-13T10:00:05Z', model: 'qwen3-4b', extras: {} },
  ],
}

async function open(payload = STORED) {
  conversation.mockResolvedValue(payload)
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
  const w = mount(AssistPanel, {
    props: { reportContext: 'R', reportId: 'report-1', editorState: { doc: {} } },
    global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
  })
  await flushPromises()
  await w.find('[data-testid="assist-toggle"]').trigger('click')
  await flushPromises()
  return w
}

describe('AssistPanel tool history', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('renders a stored tool call as a bubble', async () => {
    const w = await open()
    const bubbles = w.findAll('[data-testid^="tool-call-"]')
      .filter((n) => n.attributes('data-testid') !== 'tool-call-body')
    expect(bubbles).toHaveLength(1)
  })

  it('keeps the conversation in order around it', async () => {
    const w = await open()
    const text = w.find('[data-testid="assist-messages"]').text()
    expect(text.indexOf('who supplies Russia?')).toBeLessThan(text.indexOf('Found 7.'))
  })

  it('shows the arguments the call was made with', async () => {
    const w = await open()
    await w.find('.tool-head').trigger('click')
    expect(w.find('[data-testid="tool-call-body"]').text()).toContain('Russia')
  })

  it('says the result was not kept rather than showing an empty one', async () => {
    // An empty box reads like "the tool returned nothing", which is a
    // different and wrong claim.
    const w = await open()
    await w.find('.tool-head').trigger('click')
    const body = w.find('[data-testid="tool-call-body"]').text()
    expect(body).toMatch(/not kept/i)
    expect(body).not.toMatch(/no output/i)
  })

  it('does not render a stored call as still running', async () => {
    const w = await open()
    expect(w.find('.tool-head--running').exists()).toBe(false)
  })

  it('survives a tool row with no extras at all', async () => {
    const w = await open({
      conversation_key: 'global',
      messages: [{ id: 'c', role: 'tool', content: 'mcp__gmr__navigate', created_at: '2026-08-13T10:00:01Z' }],
    })
    const bubbles = w.findAll('[data-testid^="tool-call-"]')
      .filter((n) => n.attributes('data-testid') !== 'tool-call-body')
    expect(bubbles).toHaveLength(1)
  })
})
