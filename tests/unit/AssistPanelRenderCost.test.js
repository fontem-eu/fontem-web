import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

/**
 * The freeze that took the tab down (2026-08-28): markdown rendering was
 * an uncached method call in the template, re-run for EVERY assistant
 * message on EVERY reactive tick — each streamed chunk, each tool event,
 * each second of the elapsed timer. A long investigation turn multiplied
 * chunks by history and the main thread died; the user lost the prompt
 * and restarted the app.
 *
 * These tests price the render path: sanitisation (the expensive tail of
 * the markdown pipeline) is counted through a spying mock, and the counts
 * must scale with what CHANGED, not with chunks x history.
 */
const sanitizeCalls = []
vi.mock('../../src/utils/sanitize.js', () => ({
  sanitizeMarkdown: vi.fn((html) => {
    sanitizeCalls.push(html.length)
    return html
  }),
}))
vi.mock('../../src/api/community.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getAssistConversationPage: vi.fn().mockResolvedValue({
    messages: [
      { role: 'user', content: 'earlier question' },
      { role: 'assistant', content: 'A long earlier answer. '.repeat(200) },
    ],
    has_more: false,
    next_before: '',
  }),
  getAssistUsage: vi.fn().mockResolvedValue({ tokens_1h: 0, tokens_24h: 0, tokens_7d: 0 }),
  listAssistantModels: vi.fn().mockResolvedValue({ models: [], selected: '', active: true }),
}))
vi.mock('../../src/composables/useEditProposals.js', () => ({
  validateProposal: vi.fn(() => ({ valid: false })),
  executeProposal: vi.fn(),
}))
vi.mock('../../src/api/session.js', () => ({
  getAccessToken: vi.fn(() => 'a-token'),
  whenSessionReady: vi.fn(() => Promise.resolve()),
  refresh: vi.fn(async () => false),
}))

import AssistPanel from '../../src/components/AssistPanel.vue'

const CHUNKS = 120

function streamingReply() {
  const enc = new TextEncoder()
  const frames = []
  for (let i = 0; i < CHUNKS; i++) {
    frames.push(`event: chunk\ndata: {"text": "word${i} of a growing investigation answer. "}\n\n`)
  }
  frames.push('event: done\ndata: {}\n\n')
  let sent = 0
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => (sent < frames.length
          ? { done: false, value: enc.encode(frames[sent++]) }
          : { done: true, value: undefined }),
      }),
    },
  }
}

let wrapper
const q = (sel) => document.querySelector(sel)

describe('AssistPanel render cost under streaming', () => {
  beforeEach(() => {
    sanitizeCalls.length = 0
    vi.stubGlobal('fetch', vi.fn(async (url) => (String(url).includes('/assist/chat/stream')
      ? streamingReply()
      : { ok: true, json: async () => ({}) })))
  })

  afterEach(() => {
    wrapper?.unmount()
    document.body.innerHTML = ''
  })

  async function send() {
    wrapper = mount(AssistPanel, { attachTo: document.body })
    await flushPromises()
    q('[data-testid="assist-toggle"]').click()
    await flushPromises()
    const historyRenders = sanitizeCalls.length
    const input = q('[data-testid="assist-input"]')
    input.value = 'investigate everything'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    q('form.assist-input').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }))
    await flushPromises()
    await new Promise((r) => setTimeout(r, 50))
    await flushPromises()
    return historyRenders
  }

  it('renders the history message once, not once per streamed chunk', async () => {
    const before = await send()
    const after = sanitizeCalls.length
    // One render for the history message when it loaded, plus a bounded
    // handful for the streaming message (throttled to ~400-char growth
    // steps + the final exact render). 120 chunks used to mean hundreds
    // of sanitizer runs across the transcript.
    expect(before).toBeGreaterThan(0)
    expect(after - before).toBeLessThan(30)
  })

  it('the final rendered text is exact, throttling notwithstanding', async () => {
    await send()
    const bodyText = document.body.textContent
    expect(bodyText).toContain(`word${CHUNKS - 1}`)
    expect(bodyText).toContain('word0')
  })
})
