import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'
import { getAssistConversationPage } from '../../src/api/community.js'
import { executeProposal } from '../../src/composables/useEditProposals.js'

/**
 * The turn, in the order it happened.
 *
 * A turn is not prose-then-tools. It is prose, a tool, more prose, another
 * tool, reasoning, and an answer — each at a moment. The panel kept ONE
 * answer bubble per turn, created at the first chunk, so every tool call
 * rendered after the whole answer regardless of when it ran: "Let me look
 * that up. Found it." sitting above a search the model did between those
 * two sentences.
 *
 * These drive the real component over the SSE frames the server sends, and
 * assert the sequence of blocks rather than any one of them.
 */

vi.mock('../../src/api/community.js', async (o) => ({
  ...(await o()),
  getAssistConversation: vi.fn().mockResolvedValue(null),
  getAssistConversationPage: vi.fn().mockResolvedValue(null),
  getAssistUsage: vi.fn().mockResolvedValue({ tokens_1h: 0, tokens_24h: 0, tokens_7d: 0 }),
}))
vi.mock('../../src/composables/useEditProposals.js', async (o) => ({
  ...(await o()),
  validateProposal: vi.fn(() => ({ valid: true })),
  executeProposal: vi.fn().mockResolvedValue({ ok: true }),
}))

const sse = (e, d) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`
const say = (text) => sse('chunk', { text })
const think = (text) => sse('thinking', { text })
const tool = (name) => sse('status', { phase: 'tool_use', tool: name, detail: name, elapsed: 0.1 })
const proposal = (action, params) => sse('status', {
  phase: 'tool_use', tool: 'mcp__gmr__set_title', detail: 'set_title', elapsed: 0.1,
  proposal: { action, ...params },
})

function streamOf(chunks) {
  const enc = new TextEncoder(); let i = 0
  return { ok: true, body: { getReader: () => ({
    read: async () => (i >= chunks.length
      ? { done: true, value: undefined }
      : { done: false, value: enc.encode(chunks[i++]) }) }) } }
}

async function playTurn(chunks) {
  vi.stubGlobal('fetch', vi.fn(async (u) => (String(u).includes('/assist/chat/stream')
    ? streamOf(chunks) : { ok: true, json: async () => ({}) })))
  const w = mount(AssistPanel, {
    props: { reportContext: 'R', reportId: 'r1', editorState: { doc: {} } },
    global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
  })
  await flushPromises()
  await w.find('[data-testid="assist-toggle"]').trigger('click'); await flushPromises()
  await w.find('[data-testid="assist-input"]').setValue('write the story')
  await w.find('form.assist-input').trigger('submit'); await flushPromises()
  await new Promise((r) => setTimeout(r, 30)); await flushPromises()
  return w
}

/** The block sequence as rendered, top to bottom. */
const order = (w) => w.findAll('.assist-msg')
  .map((m) => m.classes().find((c) => c.startsWith('assist-msg--')).replace('assist-msg--', ''))
const answers = (w) => w.findAll('.msg-assistant .msg-text').map((n) => n.text())
const reasonings = (w) => w.findAll('[data-testid="assist-reasoning"]').map((n) => n.text())

describe('the turn renders in the order it happened', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('puts a tool call between the two sentences it ran between', async () => {
    const w = await playTurn([
      say('Let me look that up. '),
      tool('mcp__gmr__search_entities'),
      say('Found it.'),
      sse('done', {}),
    ])
    expect(order(w)).toEqual(['user', 'assistant', 'tool', 'assistant'])
    expect(answers(w)).toEqual(['Let me look that up.', 'Found it.'])
  })

  it('keeps a full mixed turn in sequence', async () => {
    const w = await playTurn([
      think('First I should read the article.'),
      tool('mcp__gmr__read_document'),
      think('Now I know what is there.'),
      tool('mcp__gmr__query_graph'),
      say('Spending fell after 2022. '),
      tool('mcp__gmr__calculate'),
      say('Precisely 99.2%.'),
      sse('done', {}),
    ])
    expect(order(w)).toEqual([
      'user',
      'reasoning', 'tool',
      'reasoning', 'tool',
      'assistant', 'tool',
      'assistant',
    ])
  })

  it('keeps consecutive tool calls in their own order', async () => {
    const w = await playTurn([
      say('Checking a few things. '),
      tool('mcp__gmr__search_entities'),
      tool('mcp__gmr__query_graph'),
      tool('mcp__gmr__calculate'),
      say('Done.'),
      sse('done', {}),
    ])
    expect(order(w)).toEqual(['user', 'assistant', 'tool', 'tool', 'tool', 'assistant'])
    const names = w.findAll('.msg-tool').map((n) => n.text())
    expect(names[0]).toContain('search_entities')
    expect(names[1]).toContain('query_graph')
    expect(names[2]).toContain('calculate')
  })

  it('keeps reasoning between two tools where it happened', async () => {
    const w = await playTurn([
      tool('mcp__gmr__read_document'),
      think('That article is empty, so this is a first draft.'),
      tool('mcp__gmr__query_graph'),
      sse('done', {}),
    ])
    // The turn ends with no prose at all, so the panel closes it with its
    // no-response notice. That is the real shape of a turn that reasoned,
    // acted, and never answered — and the blocks before it are still in the
    // order they happened.
    expect(order(w)).toEqual(['user', 'tool', 'reasoning', 'tool', 'error'])
    expect(reasonings(w)[0]).toContain('first draft')
  })

  it('renders each block type as its own kind of thing', async () => {
    const w = await playTurn([
      think('Working it out.'),
      tool('mcp__gmr__read_document'),
      say('The answer.'),
      sse('done', {}),
    ])
    // Reasoning is a collapsible; the answer is rendered markdown; the tool
    // is its own bubble. Three different affordances, not three paragraphs.
    expect(w.find('[data-testid="assist-reasoning"]').element.tagName).toBe('DETAILS')
    expect(w.find('.msg-tool').exists()).toBe(true)
    expect(w.find('.msg-assistant .msg-markdown').exists()).toBe(true)
  })

  it('still finds a proposal written before a tool call', async () => {
    // The end-of-stream parse reads inline JSON out of the prose, and the
    // prose is no longer one string — a proposal written before a tool call
    // now lives in an earlier bubble.
    const w = await playTurn([
      say('I will retitle it. {"proposed": true, "action": "set_title", "params": {"title": "New"}} '),
      tool('mcp__gmr__query_graph'),
      say('Done.'),
      sse('done', {}),
    ])
    expect(w.find('[data-testid="assist-proposals"]').exists()).toBe(true)
  })

  it('puts a proposal card after the tool call that produced it', async () => {
    const w = await playTurn([
      say('Let me set the title. '),
      proposal('set_title', { title: 'A better title' }),
      sse('done', {}),
    ])
    expect(order(w)).toEqual(['user', 'assistant', 'tool', 'assistant'])
    const cards = w.findAll('[data-testid="assist-proposals"]')
    expect(cards).toHaveLength(1)
  })

  it('marks an answer bubble final once something follows it', async () => {
    // renderedHtml throttles while streaming; a bubble nothing finalises
    // keeps a stale render forever.
    const long = 'x'.repeat(500)
    const w = await playTurn([
      say(`${long} first`),
      tool('mcp__gmr__query_graph'),
      say('second'),
      sse('done', {}),
    ])
    expect(answers(w)[0]).toContain('first')
    expect(answers(w)[1]).toContain('second')
  })
})

describe('accept-all spans the whole turn', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('applies every card the turn produced, in order, across bubbles', async () => {
    // Cards live on the bubble that FOLLOWS the tool call that made them, so
    // a turn with two tool calls has two bubbles with one card each.
    // Iterating only the last bubble applied half of them.
    localStorage.setItem('fontem-assist-bypass-permissions', '1')
    await playTurn([
      say('Retitling first. '),
      proposal('set_title', { title: 'A better title' }),
      say('Now the body. '),
      proposal('insert_content', { content: '<p>Body</p>' }),
      sse('done', {}),
    ])
    await flushPromises()

    expect(executeProposal).toHaveBeenCalledTimes(2)
    expect(executeProposal.mock.calls.map((c) => c[1].action))
      .toEqual(['set_title', 'insert_content'])
  })
})

describe('a reloaded turn keeps the same order', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('rebuilds reasoning, tools and answers in sequence', async () => {
    getAssistConversationPage.mockResolvedValueOnce({
      messages: [
        { role: 'user', content: 'write the story' },
        { role: 'tool', content: 'mcp__gmr__read_document',
          extras: { args: {}, reasoning: 'First I should read the article.' } },
        { role: 'tool', content: 'mcp__gmr__query_graph', extras: { args: {} } },
        { role: 'assistant', content: 'Spending fell after 2022.',
          extras: { reasoning: 'Now I can write it.' } },
      ],
      has_more: false,
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    const w = mount(AssistPanel, {
      props: { reportContext: 'R', reportId: 'r1', editorState: { doc: {} } },
      global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()
    await w.find('[data-testid="assist-toggle"]').trigger('click'); await flushPromises()

    expect(order(w)).toEqual([
      'user', 'reasoning', 'tool', 'tool', 'reasoning', 'assistant',
    ])
    expect(reasonings(w)[0]).toContain('read the article')
    expect(reasonings(w)[1]).toContain('Now I can write it')
  })
})
