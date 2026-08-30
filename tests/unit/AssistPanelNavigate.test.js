import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'

/**
 * Navigation asks before it moves anybody.
 *
 * Two bugs, reported together from production:
 *
 *  1. The assistant said "I've taken you to the Atlas" and the page did not
 *     move. The backend executor dropped the `navigate` SSE emit, so the
 *     panel was never told (see the backend's test_navigate_emit.py).
 *  2. Even working, it moved the user without asking — mid-read, mid-edit —
 *     which is the one action that takes the page out from under them.
 *
 * So the panel now renders a request and waits. The accept-all toggle does
 * NOT apply: it is a statement about proposed edits to an article the user
 * is looking at and can undo, not consent to be relocated.
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
// importOriginal spread: a bare factory replaces the module wholesale, so
// any export the panel adds later (PROPOSAL_TOOL_ACTIONS) reads undefined
// inside a swallowed try/catch — the failure is invisible.
vi.mock('../../src/composables/useEditProposals.js', async (importOriginal) => ({
  ...(await importOriginal()),
  validateProposal: vi.fn(() => ({ valid: true })),
  executeProposal: vi.fn().mockResolvedValue({ ok: true }),
}))

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ path: '/' }),
}))

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

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

async function run(chunks, { acceptAll = false } = {}) {
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
  if (acceptAll) {
    await w.find('[data-testid="assist-bypass-toggle"]').setValue(true)
    await flushPromises()
  }
  await w.find('[data-testid="assist-input"]').setValue('take me to the atlas')
  await w.find('form.assist-input').trigger('submit')
  await flushPromises()
  await new Promise((r) => setTimeout(r, 30))
  await flushPromises()
  return w
}

describe('AssistPanel navigation requests', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('asks instead of navigating when the backend emits navigate', async () => {
    const w = await run([sse('navigate', { path: '/map' }), sse('done', {})])
    expect(w.find('[data-testid="assist-nav"]').exists()).toBe(true)
    expect(push).not.toHaveBeenCalled()
  })

  it('names the destination in words, not just a path', async () => {
    const w = await run([sse('navigate', { path: '/map' }), sse('done', {})])
    const text = w.find('[data-testid="assist-nav"]').text()
    expect(text).toContain('/map')
    // The manifest describes /map; the prompt should use that description
    // rather than making the user decode a URL.
    expect(text.length).toBeGreaterThan('/map'.length + 10)
  })

  it('navigates when the user accepts', async () => {
    const w = await run([sse('navigate', { path: '/map' }), sse('done', {})])
    await w.find('[data-testid="assist-nav-go"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/map')
  })

  it('stays put when the user declines', async () => {
    const w = await run([sse('navigate', { path: '/map' }), sse('done', {})])
    await w.find('[data-testid="assist-nav-stay"]').trigger('click')
    expect(push).not.toHaveBeenCalled()
    expect(w.find('[data-testid="assist-nav-state"]').exists()).toBe(true)
  })

  it('still asks when accept-all is ON', async () => {
    // The heart of it. Accept-all is about edits, not about relocation.
    const w = await run([sse('navigate', { path: '/map' }), sse('done', {})],
      { acceptAll: true })
    expect(w.find('[data-testid="assist-nav"]').exists()).toBe(true)
    expect(w.find('[data-testid="assist-nav-go"]').exists()).toBe(true)
    expect(push).not.toHaveBeenCalled()
  })

  it('answers once — a second click cannot navigate twice', async () => {
    const w = await run([sse('navigate', { path: '/map' }), sse('done', {})])
    const go = w.find('[data-testid="assist-nav-go"]')
    await go.trigger('click')
    expect(push).toHaveBeenCalledTimes(1)
    // The buttons are gone once answered; the record of the answer stays.
    expect(w.find('[data-testid="assist-nav-go"]').exists()).toBe(false)
    expect(w.find('[data-testid="assist-nav-state"]').exists()).toBe(true)
  })

  it('declining is final — it cannot be re-accepted from the transcript', async () => {
    const w = await run([sse('navigate', { path: '/map' }), sse('done', {})])
    await w.find('[data-testid="assist-nav-stay"]').trigger('click')
    expect(w.find('[data-testid="assist-nav-go"]').exists()).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })

  it('ignores an off-site path without asking anything', async () => {
    // An open redirect must not even reach the user as a question.
    const w = await run([
      sse('navigate', { path: 'https://evil.example/steal' }),
      sse('done', {}),
    ])
    expect(w.find('[data-testid="assist-nav"]').exists()).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })

  it('ignores a path that is not in the manifest', async () => {
    const w = await run([sse('navigate', { path: '/not-a-real-page' }), sse('done', {})])
    expect(w.find('[data-testid="assist-nav"]').exists()).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })

  it('survives a malformed navigate event', async () => {
    const w = await run(['event: navigate\ndata: {not json\n\n', sse('done', {})])
    expect(w.find('[data-testid="assist-nav"]').exists()).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })

  it('asks once per navigate event', async () => {
    const w = await run([
      sse('navigate', { path: '/map' }),
      sse('navigate', { path: '/about' }),
      sse('done', {}),
    ])
    expect(w.findAll('[data-testid="assist-nav"]')).toHaveLength(2)
    expect(push).not.toHaveBeenCalled()
  })
})
