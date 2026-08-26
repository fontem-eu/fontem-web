import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'

/**
 * Opening a conversation costs the same on day two hundred as on day one.
 *
 * The panel used to fetch the whole transcript — every message the
 * conversation had ever held, on every open — and render all of it. Now it
 * takes the newest page and pulls older ones as the reader scrolls up.
 *
 * The part worth pinning is the scroll position. Prepending changes
 * scrollHeight while the browser keeps scrollTop, so without correction the
 * view jumps by the height of whatever was inserted and the reader ends up
 * somewhere they never scrolled to.
 *
 * These mount with a real Teleport rather than the usual stub. The stub
 * re-creates its slot content on every re-render, so the scroll container is
 * a different DOM node each time and every assertion about scroll position
 * reads 0 regardless of what the component did.
 */
const page = vi.fn()
vi.mock('../../src/api/community.js', () => ({
  getAssistConversation: vi.fn().mockResolvedValue({ messages: [] }),
  getAssistConversationPage: (...a) => page(...a),
  getAssistUsage: vi.fn().mockResolvedValue({ tokens_1h: 0, tokens_24h: 0, tokens_7d: 0 }),
  listAssistantModels: vi.fn().mockResolvedValue({ models: [], selected: '', active: true }),
}))
vi.mock('../../src/composables/useEditProposals.js', () => ({
  validateProposal: vi.fn(() => ({ valid: false })),
  executeProposal: vi.fn(),
}))
vi.mock('../../src/api/session.js', () => ({ getAccessToken: vi.fn(() => 'a-token') }))

const SCROLL_HEIGHT = 4000
const GROWN_HEIGHT = 6400        // after a page is prepended
const CLIENT_HEIGHT = 500

function msgs(prefix, n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`, role: i % 2 ? 'assistant' : 'user',
    content: `${prefix} ${i}`, created_at: `2026-08-25T10:00:0${i % 10}Z`, extras: {},
  }))
}

function layout(scrollHeight) {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    get() { return scrollHeight }, configurable: true,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    get() { return CLIENT_HEIGHT }, configurable: true,
  })
}

const frame = () => new Promise((r) => requestAnimationFrame(() => r()))
const q = (sel) => document.querySelector(sel)
const list = () => q('[data-testid="assist-messages"]')
const shown = () => document.body.textContent

let wrapper

async function open() {
  wrapper = mount(AssistPanel, { attachTo: document.body })
  await flushPromises()
  q('[data-testid="assist-toggle"]').click()
  await flushPromises()
  await frame()
}

async function scrollToTop() {
  list().scrollTop = 0
  list().dispatchEvent(new Event('scroll'))
  await flushPromises()
  await frame()
}

describe('AssistPanel paged history', () => {
  beforeEach(() => {
    layout(SCROLL_HEIGHT)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, body: null })))
    page.mockReset()
    page.mockResolvedValue({
      messages: msgs('recent', 30), has_more: true, next_before: 'cursor-1',
    })
  })

  afterEach(() => {
    wrapper?.unmount()
    document.body.innerHTML = ''
  })

  it('asks for a page, not the whole conversation', async () => {
    await open()
    expect(page).toHaveBeenCalledWith('global', { limit: 30 })
  })

  it('renders the page it was given', async () => {
    await open()
    expect(shown()).toContain('recent 0')
    expect(shown()).toContain('recent 29')
  })

  it('pulls the previous page when the reader reaches the top', async () => {
    await open()
    page.mockResolvedValueOnce({
      messages: msgs('older', 30), has_more: false, next_before: '',
    })
    await scrollToTop()
    expect(page).toHaveBeenLastCalledWith('global', { before: 'cursor-1', limit: 30 })
    expect(shown()).toContain('older 0')
  })

  it('keeps the reader where they were when older messages arrive', async () => {
    await open()
    page.mockImplementationOnce(async () => {
      // the prepended block makes the list taller, as a browser would
      layout(GROWN_HEIGHT)
      return { messages: msgs('older', 30), has_more: false, next_before: '' }
    })
    await scrollToTop()
    // 0 + (6400 - 4000): the view stays on the message it was on rather than
    // jumping to the top of the newly inserted block
    expect(list().scrollTop).toBe(GROWN_HEIGHT - SCROLL_HEIGHT)
  })

  it('stops asking once the server says there is no more', async () => {
    await open()
    page.mockResolvedValueOnce({ messages: msgs('older', 5), has_more: false, next_before: '' })
    await scrollToTop()
    const settled = page.mock.calls.length
    await scrollToTop()
    expect(page.mock.calls.length).toBe(settled)
  })

  it('does not fire a second request while one is in flight', async () => {
    await open()
    let release
    page.mockImplementationOnce(() => new Promise((r) => { release = r }))
    list().scrollTop = 0
    list().dispatchEvent(new Event('scroll'))
    list().dispatchEvent(new Event('scroll'))
    await flushPromises()
    const inFlight = page.mock.calls.length
    release({ messages: [], has_more: false, next_before: '' })
    await flushPromises()
    expect(inFlight).toBe(2)   // the open call plus one page request, not three
  })
})
