import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'
import { executeProposal } from '../../src/composables/useEditProposals.js'

/**
 * The propose_edit flow, driven from the SSE stream the server actually
 * sends.
 *
 * This flow had exactly one test: ASSIST-20, an end-to-end that needs a
 * logged-in browser, a story, and a local model willing to call the tool.
 * It takes five minutes, and when it fails it cannot say whether the model
 * declined, the stream broke, or the card failed to render. It has been
 * blocking promotion while pointing at all three in turn.
 *
 * Almost none of that is server behaviour. Once the stream carries a
 * proposal, everything that follows — the card appearing, surviving the
 * end-of-stream merge, applying, the applied badge, grouping, dismissal —
 * is this component. So it is pinned here, deterministically, with the
 * stream as a fixture: no model, no network, no five minutes.
 *
 * What is deliberately NOT here: whether the model chooses to call
 * propose_edit at all. That is a model property, it belongs in the eval
 * fixture, and it is the one thing the e2e should be left to prove.
 */

// Spread the real module first: the panel now streams through the
// session-aware streamRequest (real code, over the stubbed global
// fetch), so auth-header behaviour in these tests is the shipped
// behaviour rather than a re-implementation.
vi.mock('../../src/api/community.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getAssistConversation: vi.fn().mockResolvedValue(null),
  getAssistUsage: vi.fn().mockResolvedValue({
    tokens_1h: 0, tokens_24h: 0, tokens_7d: 0,
  }),
}))

vi.mock('../../src/composables/useEditProposals.js', () => ({
  validateProposal: vi.fn(() => ({ valid: true })),
  executeProposal: vi.fn().mockResolvedValue({ ok: true }),
}))

const MARKER = 'MARKER-ASSIST20-abc123'

/** One `status` frame carrying a propose_edit proposal, as the server emits it. */
function proposalEvent(overrides = {}) {
  return sse('status', {
    phase: 'tool_use',
    tool: 'mcp__gmr__propose_edit',
    detail: 'propose_edit',
    elapsed: 1.2,
    proposal: {
      action: 'insert_content',
      content: `<p>${MARKER}</p>`,
      ...overrides,
    },
  })
}

function sse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/**
 * A fetch response whose body streams `chunks` in order.
 *
 * Chunks are handed over exactly as given so a test can split one SSE frame
 * across two reads — the real transport does that, and a parser that only
 * ever sees whole frames is not the parser we ship.
 */
function streamOf(chunks) {
  const enc = new TextEncoder()
  let i = 0
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => (i >= chunks.length
          ? { done: true, value: undefined }
          : { done: false, value: enc.encode(chunks[i++]) }),
      }),
    },
  }
}

async function sendAndStream(chunks, props = {}) {
  const fetchMock = vi.fn(async (url) => (String(url).includes('/assist/chat/stream')
    ? streamOf(chunks)
    : { ok: true, json: async () => ({}) }))
  vi.stubGlobal('fetch', fetchMock)

  const wrapper = mount(AssistPanel, {
    props: {
      reportContext: 'Test Report',
      reportId: 'report-1',
      editorState: { doc: {} },
      ...props,
    },
    global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
  })
  await flushPromises()
  await wrapper.find('[data-testid="assist-toggle"]').trigger('click')
  await flushPromises()
  await wrapper.find('[data-testid="assist-input"]').setValue('add a paragraph')
  // type=submit inside <form @submit.prevent>; jsdom does not turn a
  // button click into a form submit.
  await wrapper.find('form.assist-input').trigger('submit')
  await flushPromises()
  await new Promise((r) => setTimeout(r, 30))
  await flushPromises()
  return wrapper
}

/**
 * A stream the test holds open, so the DOM can be inspected mid-turn.
 *
 * Everything else here asserts the settled state after `done`, which the
 * end-of-stream merge rebuilds from scratch — so those assertions pass even
 * if the mid-stream path is deleted outright (verified by mutation). The
 * mid-stream path is the one ASSIST-20 actually needs: at local-model speed
 * the prose tail runs for tens of seconds after the tool call, and a card
 * that waits for `done` is a card the user watches a spinner instead of.
 */
function openStream() {
  const enc = new TextEncoder()
  const queue = []
  let resolveNext = null
  let closed = false
  const pump = () => {
    if (resolveNext && queue.length) {
      const chunk = queue.shift()
      const r = resolveNext
      resolveNext = null
      r({ done: false, value: enc.encode(chunk) })
    } else if (resolveNext && closed) {
      const r = resolveNext
      resolveNext = null
      r({ done: true, value: undefined })
    }
  }
  return {
    response: {
      ok: true,
      body: {
        getReader: () => ({
          read: () => new Promise((resolve) => { resolveNext = resolve; pump() }),
        }),
      },
    },
    push: async (chunk) => {
      queue.push(chunk)
      pump()
      await flushPromises()
      await new Promise((r) => setTimeout(r, 5))
      await flushPromises()
    },
    close: async () => {
      closed = true
      pump()
      await flushPromises()
      await new Promise((r) => setTimeout(r, 5))
      await flushPromises()
    },
  }
}

async function mountWithOpenStream(stream) {
  vi.stubGlobal('fetch', vi.fn(async (url) => (String(url).includes('/assist/chat/stream')
    ? stream.response
    : { ok: true, json: async () => ({}) })))
  const wrapper = mount(AssistPanel, {
    props: {
      reportContext: 'Test Report',
      reportId: 'report-1',
      editorState: { doc: {} },
    },
    global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
  })
  await flushPromises()
  await wrapper.find('[data-testid="assist-toggle"]').trigger('click')
  await flushPromises()
  await wrapper.find('[data-testid="assist-input"]').setValue('add a paragraph')
  await wrapper.find('form.assist-input').trigger('submit')
  await flushPromises()
  return wrapper
}

const card = (w) => w.find('[data-testid="assist-proposals"]')

describe('AssistPanel propose_edit rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders the card when the proposal arrives with no prose at all', async () => {
    // The exact shape ASSIST-20 provokes. Its prompt says "Do not answer in
    // prose", so the turn can legitimately contain a tool call and nothing
    // else — and a panel that only builds the card while handling text
    // would render nothing here while looking perfectly healthy.
    const w = await sendAndStream([
      sse('status', { phase: 'connecting', detail: 'Starting...', elapsed: 0 }),
      proposalEvent(),
      sse('done', {}),
    ])
    expect(card(w).exists()).toBe(true)
    expect(w.find('[data-testid="proposal-action"]').text()).toContain('insert content')
  })

  it('renders the card when prose streams before the proposal', async () => {
    // Ordering is load-bearing. The message object is created by whichever
    // event arrives first, and a proposal attached to a message that was
    // built by a different branch is how the card silently stops updating.
    const w = await sendAndStream([
      sse('chunk', { text: 'Let me add that for you. ' }),
      sse('chunk', { text: 'Here is a paragraph.' }),
      proposalEvent(),
      sse('done', {}),
    ])
    expect(card(w).exists()).toBe(true)
  })

  it('renders the card when prose streams after the proposal', async () => {
    const w = await sendAndStream([
      proposalEvent(),
      sse('chunk', { text: 'I have proposed the edit above.' }),
      sse('usage', { input_tokens: 5555, output_tokens: 131 }),
      sse('done', {}),
    ])
    expect(card(w).exists()).toBe(true)
  })

  it('renders the card when one SSE frame is split across two reads', async () => {
    // The transport splits on buffer boundaries, not on frame boundaries.
    const frame = proposalEvent()
    const cut = Math.floor(frame.length / 2)
    const w = await sendAndStream([
      frame.slice(0, cut), frame.slice(cut), sse('done', {}),
    ])
    expect(card(w).exists()).toBe(true)
  })

  it('surfaces the proposal content so the user can see what will be inserted', async () => {
    const w = await sendAndStream([proposalEvent(), sse('done', {})])
    expect(w.find('[data-testid="proposal-desc"]').text()).toContain(MARKER)
  })

  it('keeps the card after the end-of-stream merge', async () => {
    // The merge rebuilds `proposals` from scratch at stream end. A card
    // shown mid-stream and then dropped by that rebuild is worse than one
    // that never appeared: the user sees it and reaches for it.
    const w = await sendAndStream([
      proposalEvent(),
      sse('chunk', { text: 'done' }),
      sse('done', {}),
    ])
    expect(card(w).exists()).toBe(true)
    expect(w.findAll('[data-testid="proposal-action"]')).toHaveLength(1)
  })

  it('renders one card per tool call, even when two calls are identical', async () => {
    // Two propose_edit calls are two edits the user must decide on
    // separately, even if their payloads match — collapsing them would
    // silently drop one. The merge-duplication risk (one call rendering
    // as two cards) is covered by the end-of-stream test above.
    const w = await sendAndStream([
      proposalEvent(),
      proposalEvent({ content: `<p>${MARKER}</p>` }),
      sse('done', {}),
    ])
    expect(w.findAll('[data-testid="proposal-action"]')).toHaveLength(2)
  })

  it('renders one card per distinct proposal', async () => {
    const w = await sendAndStream([
      proposalEvent({ action: 'update_title', content: 'A new title' }),
      proposalEvent(),
      sse('done', {}),
    ])
    const actions = w.findAll('[data-testid="proposal-action"]').map((n) => n.text())
    expect(actions).toEqual(['update title', 'insert content'])
  })

  it('renders no card when the turn produced no proposal', async () => {
    const w = await sendAndStream([
      sse('chunk', { text: 'The string has been added to the report as requested.' }),
      sse('done', {}),
    ])
    // The narration failure: prose claiming the edit happened, nothing to
    // apply. The panel must not invent a card to match the claim.
    expect(card(w).exists()).toBe(false)
  })

  it('a malformed proposal does not suppress a good one in the same turn', async () => {
    // The card renders `p.action.replace(...)`, so an action-less proposal
    // throws during render. Vue unwinds the whole list, so the failure is
    // not confined to the bad entry — the valid edit beside it disappears
    // too, and the user is told nothing. Asserting only that the bad card
    // is absent passes whether or not the guard exists (verified by
    // mutation); the good card is what makes this test discriminate.
    const w = await sendAndStream([
      sse('status', {
        phase: 'tool_use', tool: 'mcp__gmr__propose_edit',
        proposal: { content: 'no action field' },
      }),
      proposalEvent(),
      sse('done', {}),
    ])
    expect(w.find('[data-testid="assist-panel"]').exists()).toBe(true)
    const actions = w.findAll('[data-testid="proposal-action"]').map((n) => n.text())
    expect(actions).toEqual(['insert content'])
  })

  it('shows the card as soon as the proposal arrives, before the turn ends', async () => {
    // The regression that made ASSIST-20 flake. The card used to be built
    // only at the final merge, so nothing was clickable until the model
    // finished its prose tail — tens of seconds later. Asserting after
    // `done` cannot see this: the merge rebuilds the same card either way.
    const stream = openStream()
    const w = await mountWithOpenStream(stream)

    await stream.push(sse('status', { phase: 'thinking', detail: '...', elapsed: 0 }))
    expect(card(w).exists()).toBe(false)

    await stream.push(proposalEvent())
    expect(card(w).exists()).toBe(true)
    expect(w.find('[data-testid="proposal-apply"]').exists()).toBe(true)
  })

  it('the mid-stream card is usable while prose is still streaming', async () => {
    const stream = openStream()
    const w = await mountWithOpenStream(stream)

    await stream.push(proposalEvent())
    await stream.push(sse('chunk', { text: 'Still writing the explanation' }))
    expect(card(w).exists()).toBe(true)

    await w.find('[data-testid="proposal-apply"]').trigger('click')
    await flushPromises()
    expect(executeProposal).toHaveBeenCalledTimes(1)

    // And the still-open turn must not resurrect the Apply button when it
    // finally settles. It used to: the end-of-stream merge rebuilt the
    // cards from the raw tool events, discarding `applied`, so a second
    // click re-inserted the same paragraph.
    await stream.push(sse('chunk', { text: ' ...done.' }))
    await stream.close()
    expect(w.find('[data-testid="proposal-applied"]').exists()).toBe(true)
    expect(w.find('[data-testid="proposal-apply"]').exists()).toBe(false)
  })

  it('a proposal dismissed mid-stream does not come back when the turn ends', async () => {
    // Same root cause as the resurrected Apply button: rebuilding the list
    // at stream end undoes every decision the user made while the model
    // was still writing. Declining an edit and watching it reappear reads
    // as the assistant overriding the user.
    const stream = openStream()
    const w = await mountWithOpenStream(stream)

    await stream.push(proposalEvent())
    expect(card(w).exists()).toBe(true)
    await w.find('[data-testid="proposal-dismiss"]').trigger('click')
    await flushPromises()
    expect(card(w).exists()).toBe(false)

    await stream.push(sse('chunk', { text: 'here is why' }))
    await stream.close()
    expect(card(w).exists()).toBe(false)
  })

  it('keeps a proposal that arrived before a mid-stream error', async () => {
    // The context-overflow bug ends the turn with `event: error` after
    // real work has already streamed. Whatever arrived before the failure
    // is still valid and still worth offering.
    const w = await sendAndStream([
      proposalEvent(),
      sse('error', { error: 'Mistral API 400: exceeds the available context size' }),
      sse('done', {}),
    ])
    expect(card(w).exists()).toBe(true)
  })

  it('does not render a card when the turn only errored', async () => {
    const w = await sendAndStream([
      sse('status', { phase: 'thinking', detail: 'Processing...', elapsed: 0 }),
      sse('error', { error: 'Mistral API 500: ' }),
      sse('done', {}),
    ])
    expect(card(w).exists()).toBe(false)
  })
})

describe('AssistPanel propose_edit apply flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('applies the proposal through the shared executor when Apply is clicked', async () => {
    const w = await sendAndStream([proposalEvent(), sse('done', {})])
    await w.find('[data-testid="proposal-apply"]').trigger('click')
    await flushPromises()

    expect(executeProposal).toHaveBeenCalledTimes(1)
    const [reportId, proposal] = executeProposal.mock.calls[0]
    expect(reportId).toBe('report-1')
    // The marker is what ASSIST-20 checks lands in the editor; if it is not
    // in the payload handed to the executor, nothing downstream can put it
    // there.
    expect(JSON.stringify(proposal.params)).toContain(MARKER)
  })

  it('marks the proposal applied and withdraws the buttons', async () => {
    const w = await sendAndStream([proposalEvent(), sse('done', {})])
    await w.find('[data-testid="proposal-apply"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-testid="proposal-applied"]').exists()).toBe(true)
    // Leaving Apply clickable invites a double insert.
    expect(w.find('[data-testid="proposal-apply"]').exists()).toBe(false)
  })

  it('removes the card when the proposal is dismissed', async () => {
    const w = await sendAndStream([proposalEvent(), sse('done', {})])
    await w.find('[data-testid="proposal-dismiss"]').trigger('click')
    await flushPromises()

    expect(card(w).exists()).toBe(false)
    expect(executeProposal).not.toHaveBeenCalled()
  })

  it('auto-applies without a click when accept-all is on', async () => {
    localStorage.setItem('fontem-assist-bypass-permissions', '1')
    const w = await sendAndStream([proposalEvent(), sse('done', {})])
    await flushPromises()

    expect(executeProposal).toHaveBeenCalledTimes(1)
    expect(w.find('[data-testid="proposal-applied"]').exists()).toBe(true)
  })

  it('applies several proposals in the order they were proposed', async () => {
    // set_title then insert_content is a coherent set; applying them out of
    // order is visible to the user as the title changing after the body.
    localStorage.setItem('fontem-assist-bypass-permissions', '1')
    await sendAndStream([
      proposalEvent({ action: 'update_title', content: 'First' }),
      proposalEvent({ action: 'insert_content', content: 'Second' }),
      sse('done', {}),
    ])
    await flushPromises()

    expect(executeProposal).toHaveBeenCalledTimes(2)
    const order = executeProposal.mock.calls.map((c) => c[1].action)
    expect(order).toEqual(['update_title', 'insert_content'])
  })

  it('does not auto-apply when accept-all is off', async () => {
    const w = await sendAndStream([proposalEvent(), sse('done', {})])
    expect(executeProposal).not.toHaveBeenCalled()
    expect(w.find('[data-testid="proposal-apply"]').exists()).toBe(true)
  })
})
