import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'

/**
 * Tool calls rendered as chat history.
 *
 * The panel used to show only that the assistant was "using a tool" as a
 * transient status line, which vanished when the turn ended. If the answer
 * looked wrong there was no way to tell a bad tool result from a bad reading
 * of a good one — the evidence had already scrolled away.
 *
 * These pin the debugging surface: a bubble per call, in order, collapsed to
 * a line, expanding to the arguments and exactly what the model got back.
 */

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
  validateProposal: vi.fn(() => ({ valid: true })),
  executeProposal: vi.fn().mockResolvedValue({ ok: true }),
}))

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

const toolStart = (tool, detail) => sse('status', {
  phase: 'tool_use', tool, detail: detail || tool, elapsed: 0.4,
})
const toolDone = (tool, over) => sse('tool_result', {
  tool, args: { query: 'Meszaros' }, result: '[{"id":"gmr-1"}]',
  bytes: 4321, truncated: false, elapsed: 1.2, ...over,
})

function streamOf(chunks) {
  const enc = new TextEncoder()
  let i = 0
  return {
    ok: true,
    body: { getReader: () => ({ read: async () => (i >= chunks.length
      ? { done: true, value: undefined }
      : { done: false, value: enc.encode(chunks[i++]) }) }) },
  }
}

async function run(chunks) {
  vi.stubGlobal('fetch', vi.fn(async (url) => (String(url).includes('/assist/chat/stream')
    ? streamOf(chunks)
    : { ok: true, json: async () => ({}) })))
  const w = mount(AssistPanel, {
    props: { reportContext: 'R', reportId: 'report-1', editorState: { doc: {} } },
    global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
  })
  await flushPromises()
  await w.find('[data-testid="assist-toggle"]').trigger('click')
  await flushPromises()
  await w.find('[data-testid="assist-input"]').setValue('who is Meszaros?')
  await w.find('form.assist-input').trigger('submit')
  await flushPromises()
  await new Promise((r) => setTimeout(r, 30))
  await flushPromises()
  return w
}

const bubbles = (w) => w.findAll('[data-testid^="tool-call-"]')
  .filter((n) => n.attributes('data-testid') !== 'tool-call-body')

describe('AssistPanel tool-call bubbles', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('renders a bubble for a tool the model called', async () => {
    const w = await run([
      toolStart('mcp__gmr__search_entities', 'Searching entities: "Meszaros"'),
      toolDone('mcp__gmr__search_entities'),
      sse('done', {}),
    ])
    expect(bubbles(w)).toHaveLength(1)
    expect(w.text()).toContain('Searching entities')
  })

  it('starts collapsed — the working is available, not imposed', async () => {
    const w = await run([
      toolStart('mcp__gmr__search_entities'),
      toolDone('mcp__gmr__search_entities'),
      sse('done', {}),
    ])
    expect(w.find('[data-testid="tool-call-body"]').exists()).toBe(false)
  })

  it('expands to show what the tool actually returned', async () => {
    const w = await run([
      toolStart('mcp__gmr__search_entities'),
      toolDone('mcp__gmr__search_entities', { result: '[{"name":"Meszaros es Meszaros"}]' }),
      sse('done', {}),
    ])
    await bubbles(w)[0].trigger('click')
    await flushPromises()
    const body = w.find('[data-testid="tool-call-body"]')
    expect(body.exists()).toBe(true)
    expect(body.text()).toContain('Meszaros es Meszaros')
  })

  it('shows the arguments so a call can be reproduced', async () => {
    const w = await run([
      toolStart('mcp__gmr__investigate_entity'),
      toolDone('mcp__gmr__investigate_entity', { args: { entity_id: 'gmr-42', depth: 2 } }),
      sse('done', {}),
    ])
    await bubbles(w)[0].trigger('click')
    await flushPromises()
    const body = w.find('[data-testid="tool-call-body"]').text()
    expect(body).toContain('gmr-42')
    expect(body).toContain('depth')
  })

  it('says when the model saw less than the tool produced', async () => {
    /* The case that explains an answer which looks like it ignored data. */
    const w = await run([
      toolStart('mcp__gmr__search_entities'),
      toolDone('mcp__gmr__search_entities', { truncated: true, bytes: 90000 }),
      sse('done', {}),
    ])
    await bubbles(w)[0].trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="tool-call-body"]').text().toLowerCase())
      .toContain('truncated')
  })

  it('keeps several calls in the order the model made them', async () => {
    const w = await run([
      toolStart('mcp__gmr__search_entities'),
      toolDone('mcp__gmr__search_entities'),
      toolStart('mcp__gmr__investigate_entity'),
      toolDone('mcp__gmr__investigate_entity'),
      sse('chunk', { text: 'Here is what I found.' }),
      sse('done', {}),
    ])
    const names = bubbles(w).map((n) => n.attributes('data-testid'))
    expect(names).toEqual([
      'tool-call-mcp__gmr__search_entities',
      'tool-call-mcp__gmr__investigate_entity',
    ])
  })

  it('attaches a result to its own call when two are in flight', async () => {
    /* Executors do not all resolve tools in the order they announce them. */
    const w = await run([
      toolStart('mcp__gmr__search_entities'),
      toolStart('mcp__gmr__find_paths'),
      // In announcement order, deliberately. Completing them in REVERSE
      // order is indistinguishable from matching on "newest still running",
      // so it would pass against the bug this test exists to catch.
      toolDone('mcp__gmr__search_entities', { result: 'SEARCH-RESULT' }),
      toolDone('mcp__gmr__find_paths', { result: 'PATHS-RESULT' }),
      sse('done', {}),
    ])
    for (const b of bubbles(w)) { await b.trigger('click') }
    await flushPromises()
    const bodies = w.findAll('[data-testid="tool-call-body"]').map((n) => n.text())
    expect(bodies[0]).toContain('SEARCH-RESULT')
    expect(bodies[1]).toContain('PATHS-RESULT')
  })

  it('survives a result for a call it never saw announced', async () => {
    const w = await run([
      toolDone('mcp__gmr__search_entities'),
      sse('chunk', { text: 'still fine' }),
      sse('done', {}),
    ])
    expect(w.find('[data-testid="assist-panel"]').exists()).toBe(true)
    expect(w.text()).toContain('still fine')
  })

  it('leaves the assistant prose alongside the working, not replaced by it', async () => {
    const w = await run([
      toolStart('mcp__gmr__search_entities'),
      toolDone('mcp__gmr__search_entities'),
      sse('chunk', { text: 'Lorinc Meszaros is a Hungarian contractor.' }),
      sse('done', {}),
    ])
    expect(bubbles(w)).toHaveLength(1)
    expect(w.text()).toContain('Hungarian contractor')
  })
})
