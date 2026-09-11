import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'
import { getAssistConversationPage } from '../../src/api/community.js'

/**
 * A reasoning model's working-out, shown apart from its answer — one
 * collapsible block per stretch of it.
 *
 * In production (the conversation "Spending with Israel", 2026-09-11) one
 * assistant message was 118,236 characters, beginning "The user wants me
 * to: 1. Create queries and plots…" and ending, with no separator at all,
 * "OK let me tell the user.All three cards live." The server was sending
 * reasoning as answer text, so the panel had nothing to tell apart: the
 * single thinking block it already had was never filled.
 *
 * A turn runs reasoning, tool, reasoning, tool, answer. One block per
 * stretch keeps each piece of thinking beside the action it led to.
 */

vi.mock('../../src/api/community.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getAssistConversation: vi.fn().mockResolvedValue(null),
  getAssistConversationPage: vi.fn().mockResolvedValue(null),
  getAssistUsage: vi.fn().mockResolvedValue({ tokens_1h: 0, tokens_24h: 0, tokens_7d: 0 }),
}))

vi.mock('../../src/composables/useEditProposals.js', async (importOriginal) => ({
  ...(await importOriginal()),
  validateProposal: vi.fn(() => ({ valid: true })),
  executeProposal: vi.fn().mockResolvedValue({ ok: true }),
}))

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
const think = (text) => sse('thinking', { text })
const tool = (name) => sse('status', { phase: 'tool_use', tool: name, detail: name, elapsed: 0.1 })

function openStream() {
  const enc = new TextEncoder()
  const queue = []
  let resolveNext = null
  let closed = false
  const pump = () => {
    if (resolveNext && queue.length) {
      const r = resolveNext; resolveNext = null
      r({ done: false, value: enc.encode(queue.shift()) })
    } else if (resolveNext && closed) {
      const r = resolveNext; resolveNext = null
      r({ done: true, value: undefined })
    }
  }
  const settle = async () => {
    await flushPromises(); await new Promise((r) => setTimeout(r, 5)); await flushPromises()
  }
  return {
    response: { ok: true, body: { getReader: () => ({ read: () => new Promise((res) => { resolveNext = res; pump() }) }) } },
    push: async (chunk) => { queue.push(chunk); pump(); await settle() },
    close: async () => { closed = true; pump(); await settle() },
  }
}

async function mountPanel(stream) {
  vi.stubGlobal('fetch', vi.fn(async (url) => (String(url).includes('/assist/chat/stream')
    ? stream.response
    : { ok: true, json: async () => ({}) })))
  const w = mount(AssistPanel, {
    props: { reportContext: 'Test Report', reportId: 'report-1', editorState: { doc: {} } },
    global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
  })
  await flushPromises()
  await w.find('[data-testid="assist-toggle"]').trigger('click')
  await flushPromises()
  await w.find('[data-testid="assist-input"]').setValue('write the story')
  await w.find('form.assist-input').trigger('submit')
  await flushPromises()
  return w
}

const blocks = (w) => w.findAll('[data-testid="assist-reasoning"]')
const answer = (w) => w.find('.msg-assistant .msg-text')

describe('AssistPanel reasoning blocks', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('keeps the reasoning out of the answer', async () => {
    const s = openStream()
    const w = await mountPanel(s)
    await s.push(think('The user wants me to add three charts.'))
    await s.push(sse('chunk', { text: 'All three cards are live.' }))
    await s.push(sse('done', {})); await s.close()

    expect(blocks(w)).toHaveLength(1)
    expect(blocks(w)[0].text()).toContain('The user wants me to add three charts.')
    expect(answer(w).text()).toContain('All three cards are live.')
    expect(answer(w).text()).not.toContain('The user wants')
  })

  it('gives each stretch of reasoning its own block, beside the action it led to', async () => {
    const s = openStream()
    const w = await mountPanel(s)
    await s.push(think('First I should read the article.'))
    await s.push(tool('mcp__gmr__read_document'))
    await s.push(think('Now I know what is there.'))
    await s.push(sse('chunk', { text: 'Done.' }))
    await s.push(sse('done', {})); await s.close()

    expect(blocks(w)).toHaveLength(2)
    // In timeline order: reasoning, tool, reasoning, answer.
    const order = w.findAll('.assist-msg').map((m) => m.classes().find((c) => c.startsWith('assist-msg--')))
    expect(order).toEqual([
      'assist-msg--user', 'assist-msg--reasoning', 'assist-msg--tool',
      'assist-msg--reasoning', 'assist-msg--assistant',
    ])
  })

  it('merges consecutive pieces of one stretch into a single block', async () => {
    // The server streams reasoning in many small deltas; a block per delta
    // would be a wall of one-word boxes.
    const s = openStream()
    const w = await mountPanel(s)
    await s.push(think('The user '))
    await s.push(think('wants '))
    await s.push(think('three charts.'))
    expect(blocks(w)).toHaveLength(1)
    expect(blocks(w)[0].text()).toContain('The user wants three charts.')
  })

  it('shows the block being written open, and folds it once something follows', async () => {
    const s = openStream()
    const w = await mountPanel(s)
    await s.push(think('Thinking about which chart goes first.'))
    expect(blocks(w)[0].attributes('open')).toBeDefined()

    await s.push(tool('mcp__gmr__read_document'))
    expect(blocks(w)[0].attributes('open')).toBeUndefined()
  })

  it('folds every block once the turn is over', async () => {
    const s = openStream()
    const w = await mountPanel(s)
    await s.push(think('Last thought, and no answer after it.'))
    await s.push(sse('done', {})); await s.close()
    expect(blocks(w)[0].attributes('open')).toBeUndefined()
  })

  it('renders reasoning as text, never as markup', async () => {
    // It is the model thinking aloud, not content for the reader.
    const s = openStream()
    const w = await mountPanel(s)
    await s.push(think('<img src=x onerror=alert(1)> **not bold**'))
    expect(blocks(w)[0].find('img').exists()).toBe(false)
    expect(blocks(w)[0].text()).toContain('<img src=x onerror=alert(1)>')
  })
})

describe('AssistPanel reasoning on reload', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('puts each stored reasoning block back before the row it led to, folded', async () => {
    getAssistConversationPage.mockResolvedValueOnce({
      messages: [
        { role: 'user', content: 'write the story' },
        { role: 'tool', content: 'mcp__gmr__read_document',
          extras: { args: {}, reasoning: 'I should read the article first.' } },
        { role: 'assistant', content: 'All three cards are live.',
          extras: { reasoning: 'Now I know what is there.' } },
      ],
      has_more: false,
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    const w = mount(AssistPanel, {
      props: { reportContext: 'Test Report', reportId: 'report-1', editorState: { doc: {} } },
      global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()
    await w.find('[data-testid="assist-toggle"]').trigger('click')
    await flushPromises()

    const order = w.findAll('.assist-msg').map((m) => m.classes().find((c) => c.startsWith('assist-msg--')))
    expect(order).toEqual([
      'assist-msg--user', 'assist-msg--reasoning', 'assist-msg--tool',
      'assist-msg--reasoning', 'assist-msg--assistant',
    ])
    for (const b of blocks(w)) expect(b.attributes('open')).toBeUndefined()
  })
})
