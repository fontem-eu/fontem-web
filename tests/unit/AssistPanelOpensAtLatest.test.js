import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'

/**
 * The panel opens on the newest message, not the oldest.
 *
 * loadConversation() always called scrollToBottom() — from onMounted(), while
 * the panel is still closed. A closed panel has no laid out message list:
 * scrollHeight is 0, so `scrollTop = scrollHeight` assigns 0 and the
 * conversation opens at the very first thing the user ever said. toggle()
 * opened the panel and loaded the model list, and never scrolled.
 *
 * jsdom reports 0 for every layout property, which is why the element is given
 * a scrollHeight here: without it the old code passes trivially and this test
 * proves nothing.
 */
const conversation = vi.fn()
vi.mock('../../src/api/community.js', () => ({
  getAssistConversation: (...a) => conversation(...a),
  getAssistUsage: vi.fn().mockResolvedValue({ tokens_1h: 0, tokens_24h: 0, tokens_7d: 0 }),
  listAssistantModels: vi.fn().mockResolvedValue({ models: [], selected: '', active: true }),
}))
vi.mock('../../src/composables/useEditProposals.js', () => ({
  validateProposal: vi.fn(() => ({ valid: false })),
  executeProposal: vi.fn(),
}))
vi.mock('../../src/api/session.js', () => ({ getAccessToken: vi.fn(() => 'a-token') }))

const LONG = {
  conversation_key: 'global',
  messages: Array.from({ length: 40 }, (_, i) => ({
    id: `m${i}`,
    role: i % 2 ? 'assistant' : 'user',
    content: `message ${i}`,
    created_at: `2026-08-13T10:${String(i).padStart(2, '0')}:00Z`,
    extras: {},
  })),
}

const SCROLL_HEIGHT = 4000
const CLIENT_HEIGHT = 500

/*
 * Give every element the layout jsdom refuses to compute.
 *
 * On the prototype rather than on one node: rendering the jump-to-latest
 * control replaces the message list element, so a reference captured before
 * the click is stale by the time it is asserted on — which looked like the
 * component failing to scroll when it was the test holding the wrong node.
 */
function measureAll() {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    get() { return SCROLL_HEIGHT }, configurable: true,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    get() { return CLIENT_HEIGHT }, configurable: true,
  })
}

async function frame() {
  // the watcher scrolls inside requestAnimationFrame, after the open transition
  await new Promise((r) => requestAnimationFrame(() => r()))
  await flushPromises()
}

/** Always read the live node: the Teleport stub re-creates slot content. */
function list(wrapper) {
  return wrapper.find('[data-testid="assist-messages"]').element
}

async function openPanel() {
  const wrapper = mount(AssistPanel, {
    global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
  })
  await flushPromises()
  await wrapper.find('[data-testid="assist-toggle"]').trigger('click')
  await flushPromises()
  await frame()
  return { wrapper }
}

describe('AssistPanel opens at the latest message', () => {
  beforeEach(() => {
    measureAll()
    conversation.mockResolvedValue(LONG)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, body: null })))
  })

  it('scrolls to the end of a restored conversation when opened', async () => {
    const { wrapper } = await openPanel()
    expect(list(wrapper).scrollTop).toBe(SCROLL_HEIGHT)
  })

  it('does not leave the view at the top', async () => {
    const { wrapper } = await openPanel()
    expect(list(wrapper).scrollTop).not.toBe(0)
  })

  it('hides the jump-to-latest control while already at the latest', async () => {
    const { wrapper } = await openPanel()
    expect(wrapper.find('[data-testid="assist-jump-latest"]').exists()).toBe(false)
  })

  it('offers jump-to-latest once the reader scrolls up', async () => {
    const { wrapper } = await openPanel()
    list(wrapper).scrollTop = 0
    await wrapper.find('[data-testid="assist-messages"]').trigger('scroll')
    await flushPromises()
    expect(wrapper.find('[data-testid="assist-jump-latest"]').exists()).toBe(true)
  })

  it('jump-to-latest puts the reader back at the newest message', async () => {
    // Asserted through the control rather than through scrollTop on a cached
    // node: the Teleport stub used to mount this panel re-creates its slot
    // content on re-render, so an element captured before the click is a
    // different node afterwards and always reads scrollTop 0. The contract a
    // user can see is that the control does its job and then goes away.
    const { wrapper } = await openPanel()
    list(wrapper).scrollTop = 0
    await wrapper.find('[data-testid="assist-messages"]').trigger('scroll')
    await flushPromises()
    expect(wrapper.find('[data-testid="assist-jump-latest"]').exists()).toBe(true)

    await wrapper.find('[data-testid="assist-jump-latest"]').trigger('click')
    await frame()
    expect(wrapper.find('[data-testid="assist-jump-latest"]').exists()).toBe(false)
  })
})
