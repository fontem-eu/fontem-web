import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'
import { executeProposal } from '../../src/composables/useEditProposals.js'
import {
  registerStudioContext, registerEditorContext, requestAssist, useAssistantContext,
} from '../../src/composables/useAssistantContext.js'
import { useStudioProposal } from '../../src/composables/useStudioProposal.js'

/**
 * The assistant inside the Data Studio: one conversation per project, and
 * the query on screen proposed as a diff the user accepts or rejects whole.
 *
 * The owner's rules, each pinned here from the stream the server sends:
 *
 *  - The turn carries the project and the open query, so the server can
 *    offer the propose tool at all (the has_editor lesson, one floor down).
 *  - A proposal is announced on the tool_use event but is not OFFERED until
 *    the tool_result says the engine accepted it. Between the two the card
 *    says it is checking, has no buttons, and nothing is locked.
 *  - Once confirmed, the composer locks until the user decides — on the
 *    card, or on the notice above the composer — and accept-all does not
 *    decide for them.
 *  - The model speaking again replaces what it said: the earlier card says
 *    so and loses its buttons. A card the server never answered is refused
 *    as unconfirmed rather than left clickable.
 *
 * Driven through the DOM and the public composables only: the applier is
 * what the query view registers, so "accepted" means the applier was
 * handed the text — never a spy on the panel's internals.
 */

// Spread the real module first: the panel streams through the session-aware
// streamRequest (real code, over the stubbed global fetch), and the turn
// body asserted below is the one the server actually receives.
vi.mock('../../src/api/community.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getAssistConversation: vi.fn().mockResolvedValue(null),
  getAssistUsage: vi.fn().mockResolvedValue({ tokens_1h: 0, tokens_24h: 0, tokens_7d: 0 }),
}))
// importOriginal spread: PROPOSAL_TOOL_ACTIONS must stay defined, or the
// tool_result matching fails inside a swallowed try/catch.
vi.mock('../../src/composables/useEditProposals.js', async (importOriginal) => ({
  ...(await importOriginal()),
  validateProposal: vi.fn(() => ({ valid: true })),
  executeProposal: vi.fn().mockResolvedValue({ ok: true }),
}))

// Signed in: the conversation bar — and with it the chat's title — only
// renders for someone with an account. Spread so streamRequest's refresh
// path keeps its real collaborators.
vi.mock('../../src/api/session.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getAccessToken: () => 'a-token',
}))

// Where the panel is. Mutable so a test can put the panel on the query page
// itself, where the "open the query" link would point at the page in view.
const routeState = vi.hoisted(() => ({ path: '/', fullPath: '/' }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => routeState,
}))

const PID = '11111111-1111-4111-8111-111111111111'
const QID = '22222222-2222-4222-8222-222222222222'
const NEW_QUERY = 'MATCH (c:Company) RETURN count(c) AS companies'
const EXPLANATION = 'Counts the companies instead of listing them.'

/** The open query as the view's getter reports it. */
const SNAPSHOT = {
  id: QID, name: 'Top companies', lang: 'cypher',
  text: 'MATCH (c:Company) RETURN c.name AS name LIMIT 5',
  lastError: null, columns: ['name'],
}

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

const toolArgs = (over = {}) => ({
  project_id: PID, query_id: QID, query: NEW_QUERY, explanation: EXPLANATION, ...over,
})

/** The status frame the server emits when the model calls the propose tool. */
function proposeEvent(over = {}) {
  return sse('status', {
    phase: 'tool_use',
    tool: 'mcp__gmr__studio_propose_query',
    detail: 'Proposing a query',
    elapsed: 0.3,
    proposal: { ...toolArgs(over), action: 'propose_query' },
  })
}

/** The tool_result that follows: the engine's verdict on the text. */
function proposeResult(over = {}, result = null) {
  return sse('tool_result', {
    tool: 'mcp__gmr__studio_propose_query',
    args: toolArgs(over),
    result: JSON.stringify(result || {
      proposed: true, action: 'propose_query', project_id: PID, query_id: QID,
      columns: ['companies'], warnings: [],
    }),
    elapsed: 0.8,
    bytes: 120,
  })
}

const REFUSAL = {
  error: 'the proposal was withdrawn because the query does not work: Invalid input',
}

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

/** A stream the test holds open, so the DOM can be inspected mid-turn. */
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
  const settle = async () => {
    await flushPromises()
    await new Promise((r) => setTimeout(r, 5))
    await flushPromises()
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
    push: async (chunk) => { queue.push(chunk); pump(); await settle() },
    close: async () => { closed = true; pump(); await settle() },
  }
}

let fetchMock
let wrapper
let disposeStudio = null
let disposeEditor = null
let disposeApplier = null

function stubFetch(streamResponse) {
  fetchMock = vi.fn(async (url) => (String(url).includes('/assist/chat/stream')
    ? streamResponse()
    : { ok: true, json: async () => ({}) }))
  vi.stubGlobal('fetch', fetchMock)
}

const streamCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes('/assist/chat/stream'))

function lastBody() {
  const calls = streamCalls()
  if (!calls.length) throw new Error('no stream request was made')
  return JSON.parse(calls[calls.length - 1][1].body)
}

function registerStudio({ query = SNAPSHOT, projectName = 'Lobby map' } = {}) {
  disposeStudio = registerStudioContext({ projectId: PID, projectName, getQuery: () => query })
}

/** What the query view registers: takes the text, reports it landed. */
function registerApplier() {
  const applier = vi.fn(async () => true)
  disposeApplier = useStudioProposal().registerApplier(applier)
  return applier
}

function mountPanel(props = {}) {
  wrapper = mount(AssistPanel, {
    props,
    global: {
      stubs: {
        Teleport: { template: '<div><slot /></div>' },
        'router-link': { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
  return wrapper
}

async function openPanel(w) {
  await flushPromises()
  await w.find('[data-testid="assist-toggle"]').trigger('click')
  await flushPromises()
}

async function submit(w, text = 'count the companies') {
  await w.find('[data-testid="assist-input"]').setValue(text)
  // type=submit inside <form @submit.prevent>; jsdom does not turn a
  // button click into a form submit.
  await w.find('form.assist-input').trigger('submit')
  await flushPromises()
  await new Promise((r) => setTimeout(r, 30))
  await flushPromises()
}

/** Mount, open, send: the stream is consumed to the end before returning. */
async function sendAndStream(chunks, props = {}) {
  stubFetch(() => streamOf(chunks))
  const w = mountPanel(props)
  await openPanel(w)
  await submit(w)
  return w
}

async function mountWithOpenStream(stream, props = {}) {
  stubFetch(() => stream.response)
  const w = mountPanel(props)
  await openPanel(w)
  await w.find('[data-testid="assist-input"]').setValue('count the companies')
  await w.find('form.assist-input').trigger('submit')
  await flushPromises()
  return w
}

const input = (w) => w.find('[data-testid="assist-input"]')
const isDisabled = (node) => node.attributes('disabled') !== undefined
const locked = (w) => w.find('[data-testid="assist-locked"]').exists()

/** The confirmed-proposal stream: announced, validated, explained, done. */
const CONFIRMED = () => [
  proposeEvent(),
  proposeResult(),
  sse('chunk', { text: 'I proposed a count instead of a list.' }),
  sse('done', {}),
]

describe('AssistPanel in the Data Studio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useStudioProposal()._reset()
    routeState.path = '/'
    routeState.fullPath = '/'
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    disposeApplier?.(); disposeApplier = null
    disposeStudio?.(); disposeStudio = null
    // registerStudioContext's dispose compares its raw object with the ref's
    // reactive proxy and so never clears (reported to the composable's
    // owner); withdraw through the public ref so no test inherits a project.
    useAssistantContext().studioContext.value = null
    disposeEditor?.(); disposeEditor = null
    useStudioProposal()._reset()
  })

  describe('conversation and turn body', () => {
    it('scopes the conversation to the project while a Studio view is registered', async () => {
      registerStudio()
      await sendAndStream([sse('done', {})])
      expect(lastBody().conversation_key).toBe(`studio:${PID}`)
    })

    it('the article wins over the project when both are on screen', async () => {
      // A report opened from inside a project is still a report being
      // edited; its chat stays with the article.
      registerStudio()
      disposeEditor = registerEditorContext({ id: 'r-1', context: 'ctx' })
      await sendAndStream([sse('done', {})])
      expect(lastBody().conversation_key).toBe('report:r-1')
    })

    it('a report handed in as a prop wins over the project too', async () => {
      registerStudio()
      await sendAndStream([sse('done', {})], { reportId: 'report-9', reportContext: 'R', editorState: { doc: {} } })
      expect(lastBody().conversation_key).toBe('report:report-9')
    })

    it('moves to the project conversation when a Studio view registers after mount', async () => {
      stubFetch(() => streamOf([sse('done', {})]))
      const w = mountPanel()
      await openPanel(w)
      registerStudio()
      await flushPromises()
      await submit(w)
      expect(lastBody().conversation_key).toBe(`studio:${PID}`)
    })

    it('names the project chat after the project until the user renames it', async () => {
      // The server mints `studio:` keys without a title; "New chat" over a
      // thread that is plainly about one project reads as the panel having
      // lost track of where it is.
      registerStudio({ projectName: 'Lobby map' })
      stubFetch(() => streamOf([sse('done', {})]))
      const w = mountPanel()
      await openPanel(w)
      expect(w.find('[data-testid="assist-conversation-switcher"]').text()).toContain('Studio · Lobby map')
    })

    it('sends the open query exactly as the view reports it', async () => {
      registerStudio()
      await sendAndStream([sse('done', {})])
      expect(lastBody().studio).toEqual({
        project_id: PID,
        project_name: 'Lobby map',
        query: {
          id: QID, name: 'Top companies', lang: 'cypher',
          text: SNAPSHOT.text, last_error: null, columns: ['name'],
        },
      })
    })

    it('sends a null query for a view with nothing open', async () => {
      registerStudio({ query: null })
      await sendAndStream([sse('done', {})])
      expect(lastBody().studio).toEqual({ project_id: PID, project_name: 'Lobby map', query: null })
    })

    it('sends no studio field outside the Studio', async () => {
      await sendAndStream([sse('done', {})])
      expect('studio' in lastBody()).toBe(false)
    })
  })

  describe('a proposed query', () => {
    it('is announced as checking — no buttons, no lock — until the server confirms it', async () => {
      // The card is drawn from the tool_use event so the user sees the model
      // at work, but the text has not met the engine yet: offering it now
      // would let the user accept a query that is about to be refused, and
      // locking now would lock over nothing.
      const stream = openStream()
      const w = await mountWithOpenStream(stream)
      await stream.push(proposeEvent())

      expect(w.find('[data-testid="proposal-checking"]').exists()).toBe(true)
      expect(w.find('[data-testid="proposal-desc"]').text()).toBe(EXPLANATION)
      expect(w.find('[data-testid="proposal-apply"]').exists()).toBe(false)
      expect(w.find('[data-testid="proposal-dismiss"]').exists()).toBe(false)
      expect(locked(w)).toBe(false)
      expect(useStudioProposal().locked.value).toBe(false)
      await stream.close()
    })

    it('locks the composer once the server confirms it, and the card offers the decision', async () => {
      const w = await sendAndStream(CONFIRMED())

      expect(locked(w)).toBe(true)
      expect(isDisabled(input(w))).toBe(true)
      expect(isDisabled(w.find('[data-testid="assist-send"]'))).toBe(true)
      expect(w.find('[data-testid="proposal-checking"]').exists()).toBe(false)
      expect(w.find('[data-testid="proposal-apply"]').exists()).toBe(true)
      expect(w.find('[data-testid="proposal-dismiss"]').exists()).toBe(true)
      expect(useStudioProposal().pending.value).toMatchObject({
        projectId: PID, queryId: QID, query: NEW_QUERY, explanation: EXPLANATION,
      })
    })

    it('carries the store the model chose into the proposal', async () => {
      // The model decided the answer lives in Virtuoso: the language it
      // named must reach the editor and the save, not just the text.
      const sparql = 'SELECT ?act WHERE { ?act a ?t } LIMIT 5'
      await sendAndStream([
        proposeEvent({ query: sparql, lang: 'sparql' }),
        proposeResult({ query: sparql, lang: 'sparql' }),
        sse('done', {}),
      ])
      expect(useStudioProposal().pending.value).toMatchObject({ query: sparql, lang: 'sparql' })
    })

    it('a refusal leaves the card refused and the composer free', async () => {
      const w = await sendAndStream([
        proposeEvent(),
        proposeResult({}, REFUSAL),
        sse('done', {}),
      ])

      expect(w.find('[data-testid="proposal-refused"]').text()).toContain('does not work')
      expect(w.find('[data-testid="proposal-checking"]').exists()).toBe(false)
      expect(w.find('[data-testid="proposal-apply"]').exists()).toBe(false)
      expect(locked(w)).toBe(false)
      expect(isDisabled(input(w))).toBe(false)
    })

    it('a card the server never answered is refused as unconfirmed when the turn ends', async () => {
      // The stream ended without a tool_result: the text was never
      // validated and nothing is pending, so an Apply would land on air.
      const w = await sendAndStream([
        proposeEvent(),
        sse('chunk', { text: 'Here you go.' }),
        sse('done', {}),
      ])

      expect(w.find('[data-testid="proposal-checking"]').exists()).toBe(false)
      expect(w.find('[data-testid="proposal-refused"]').text()).toContain('not confirmed')
      expect(w.find('[data-testid="proposal-apply"]').exists()).toBe(false)
      expect(locked(w)).toBe(false)
    })

    it('is replaced by a later proposal, whose card is the only one left to decide', async () => {
      const second = 'MATCH (c:Company) RETURN c.name LIMIT 3'
      const w = await sendAndStream([
        proposeEvent(),
        proposeResult(),
        proposeEvent({ query: second }),
        proposeResult({ query: second }),
        sse('done', {}),
      ])

      const cards = w.findAll('[data-testid="assist-proposals"]')
      expect(cards).toHaveLength(2)
      expect(cards[0].find('[data-testid="proposal-superseded"]').exists()).toBe(true)
      expect(cards[0].find('[data-testid="proposal-apply"]').exists()).toBe(false)
      expect(cards[0].find('[data-testid="proposal-dismiss"]').exists()).toBe(false)
      expect(cards[1].find('[data-testid="proposal-superseded"]').exists()).toBe(false)
      expect(cards[1].find('[data-testid="proposal-apply"]').exists()).toBe(true)
      expect(useStudioProposal().pending.value.query).toBe(second)
    })
  })

  describe('deciding', () => {
    it('accepting from the card hands the text to the applier and unlocks', async () => {
      const applier = registerApplier()
      const w = await sendAndStream(CONFIRMED())

      await w.find('[data-testid="proposal-apply"]').trigger('click')
      await flushPromises()

      expect(applier).toHaveBeenCalledTimes(1)
      expect(applier.mock.calls[0][0]).toMatchObject({ queryId: QID, query: NEW_QUERY })
      // Not the article's path: a query is not an edit to a story.
      expect(executeProposal).not.toHaveBeenCalled()
      expect(w.find('[data-testid="proposal-applied"]').exists()).toBe(true)
      expect(w.find('[data-testid="proposal-apply"]').exists()).toBe(false)
      expect(locked(w)).toBe(false)
      expect(isDisabled(input(w))).toBe(false)
    })

    it('accepting from the notice marks the card applied', async () => {
      const applier = registerApplier()
      const w = await sendAndStream(CONFIRMED())

      await w.find('[data-testid="assist-locked-accept"]').trigger('click')
      await flushPromises()

      expect(applier).toHaveBeenCalledTimes(1)
      expect(w.find('[data-testid="proposal-applied"]').exists()).toBe(true)
      expect(locked(w)).toBe(false)
    })

    it('rejecting from the notice unlocks and removes the card', async () => {
      const applier = registerApplier()
      const w = await sendAndStream(CONFIRMED())

      await w.find('[data-testid="assist-locked-reject"]').trigger('click')
      await flushPromises()

      expect(applier).not.toHaveBeenCalled()
      expect(locked(w)).toBe(false)
      expect(isDisabled(input(w))).toBe(false)
      expect(w.find('[data-testid="assist-proposals"]').exists()).toBe(false)
      expect(useStudioProposal().pending.value).toBeNull()
    })

    it('dismissing the card rejects the proposal', async () => {
      const w = await sendAndStream(CONFIRMED())
      await w.find('[data-testid="proposal-dismiss"]').trigger('click')
      await flushPromises()
      expect(locked(w)).toBe(false)
      expect(w.find('[data-testid="assist-proposals"]').exists()).toBe(false)
    })

    it('a failed accept keeps the card, the lock, and says why', async () => {
      disposeApplier = useStudioProposal().registerApplier(async () => {
        throw new Error('PUT /queries 409')
      })
      const w = await sendAndStream(CONFIRMED())

      await w.find('[data-testid="proposal-apply"]').trigger('click')
      await flushPromises()

      expect(w.find('[data-testid="assist-error"]').text()).toContain('PUT /queries 409')
      expect(w.find('[data-testid="proposal-apply"]').exists()).toBe(true)
      expect(locked(w)).toBe(true)
    })

    it('accept-all never applies a proposed query', async () => {
      // The review is the feature. Accept-all was agreed to for edits to an
      // article the user is looking at, not for rewriting the query under
      // their cursor without a look at the diff.
      localStorage.setItem('fontem-assist-bypass-permissions', '1')
      const applier = registerApplier()
      const w = await sendAndStream(CONFIRMED())

      expect(applier).not.toHaveBeenCalled()
      expect(w.find('[data-testid="proposal-applied"]').exists()).toBe(false)
      expect(w.find('[data-testid="proposal-apply"]').exists()).toBe(true)
      expect(locked(w)).toBe(true)
    })
  })

  describe('the lock', () => {
    it('does not send while a proposal is pending', async () => {
      stubFetch(() => streamOf([sse('done', {})]))
      const w = mountPanel()
      await openPanel(w)
      // A draft typed before the lock landed: the disabled attribute stops
      // a person from typing more, not a submit of what is already there,
      // so the handler itself must refuse.
      await input(w).setValue('and now?')
      useStudioProposal().propose({ projectId: PID, queryId: QID, query: NEW_QUERY, explanation: EXPLANATION })
      await flushPromises()
      expect(isDisabled(input(w))).toBe(true)

      await w.find('form.assist-input').trigger('submit')
      await flushPromises()
      await new Promise((r) => setTimeout(r, 30))
      expect(streamCalls()).toHaveLength(0)
    })

    it('links to the query when the panel is on another page', async () => {
      const w = await sendAndStream(CONFIRMED())
      const link = w.find('[data-testid="assist-locked-open"]')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe(`/studio/p/${PID}/q/${QID}`)
    })

    it('offers no link on the query page itself', async () => {
      routeState.path = `/studio/p/${PID}/q/${QID}`
      const w = await sendAndStream(CONFIRMED())
      expect(locked(w)).toBe(true)
      expect(w.find('[data-testid="assist-locked-open"]').exists()).toBe(false)
    })
  })

  describe('requestAssist', () => {
    it('opens the panel with the prompt in the composer, unsent', async () => {
      stubFetch(() => streamOf([sse('done', {})]))
      const w = mountPanel()
      await flushPromises()
      expect(w.find('[data-testid="assist-panel"]').exists()).toBe(false)

      requestAssist({ prompt: 'Write a Cypher query that ' })
      await flushPromises()
      await flushPromises()

      expect(w.find('[data-testid="assist-panel"]').exists()).toBe(true)
      expect(input(w).element.value).toBe('Write a Cypher query that ')
      expect(streamCalls()).toHaveLength(0)
      // Consumed: the same request must not reopen the panel later.
      expect(useAssistantContext().assistRequest.value).toBeNull()
    })

    it('replaces the draft in an already open panel', async () => {
      stubFetch(() => streamOf([sse('done', {})]))
      const w = mountPanel()
      await openPanel(w)
      await input(w).setValue('half-typed')

      requestAssist({ prompt: 'This query fails with: "x". Please fix it.' })
      await flushPromises()
      await flushPromises()

      expect(input(w).element.value).toBe('This query fails with: "x". Please fix it.')
    })
  })
})
