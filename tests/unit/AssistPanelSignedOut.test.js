import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'
import { getAccessToken } from '../../src/api/session.js'

// The panel is mounted on every page except /login, and it was always sent
// without an Authorization header when there was no session — the server
// simply answered 401. Now the server answers, so these pin the client half
// of that: a signed-out visitor gets a working panel, and the panel does not
// invent a session to get it.
vi.mock('../../src/api/session.js', () => ({
  getAccessToken: vi.fn(() => null),
}))
vi.mock('../../src/api/community.js', () => ({
  getAssistConversation: vi.fn().mockResolvedValue(null),
  getAssistUsage: vi.fn().mockRejectedValue(new Error('401')),
  listAssistantModels: vi.fn().mockRejectedValue(new Error('401')),
}))
vi.mock('../../src/composables/useEditProposals.js', () => ({
  validateProposal: vi.fn(() => ({ valid: false })),
  executeProposal: vi.fn(),
}))

function sseReply() {
  const enc = new TextEncoder().encode(
    'event: chunk\ndata: {"text": "Try the companies page."}\n\n'
    + 'event: done\ndata: {}\n\n')
  let sent = false
  return {
    ok: true,
    body: { getReader: () => ({ read: async () => (sent
      ? { done: true, value: undefined }
      : ((sent = true), { done: false, value: enc })) }) },
  }
}

describe('AssistPanel without a session', () => {
  let fetchMock
  beforeEach(() => {
    fetchMock = vi.fn(async () => sseReply())
    vi.stubGlobal('fetch', fetchMock)
  })

  async function send() {
    const wrapper = mount(AssistPanel, {
      global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()
    await wrapper.find('[data-testid="assist-toggle"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="assist-input"]').setValue('where are companies?')
    await wrapper.find('form.assist-input').trigger('submit')
    await flushPromises()
    await new Promise((r) => setTimeout(r, 30))
    await flushPromises()
    const call = fetchMock.mock.calls.find(
      (c) => String(c[0]).includes('/assist/chat/stream'))
    return { wrapper, call }
  }

  it('sends the turn even with no token', async () => {
    const { call } = await send()
    expect(call).toBeTruthy()
  })

  it('does not send an Authorization header it does not have', async () => {
    // The old code spread `...(token ? {Authorization} : {})`; a regression
    // to `Bearer null` would be accepted by nothing and is worth pinning.
    const { call } = await send()
    expect(call[1].headers.Authorization).toBeUndefined()
  })

  it('still sends the site map, which is the only tool it will get', async () => {
    const { call } = await send()
    const body = JSON.parse(call[1].body)
    expect(Array.isArray(body.nav?.routes)).toBe(true)
    expect(body.nav.routes.length).toBeGreaterThan(0)
  })

  it('renders the reply', async () => {
    const { wrapper } = await send()
    expect(wrapper.text()).toContain('Try the companies page.')
  })

  it('does not offer a model picker', async () => {
    // /assist/models is refused without an account; the picker must simply
    // not appear rather than render empty or error into the chat.
    const { wrapper } = await send()
    expect(wrapper.find('[data-testid="assist-model-select"]').exists()).toBe(false)
  })
})

// What the visitor is told, and what the input lets them type. Without the
// notice the panel looks identical signed in or out, so a reduced answer
// reads as the assistant being unwilling rather than unauthenticated.
describe('AssistPanel limits shown to a signed-out visitor', () => {
  const SERVER_LIMIT = 1000   // ANONYMOUS_MAX_PROMPT_CHARS, fontem-community-api

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => sseReply()))
    getAccessToken.mockReturnValue(null)
  })

  async function open() {
    const wrapper = mount(AssistPanel, {
      global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()
    await wrapper.find('[data-testid="assist-toggle"]').trigger('click')
    await flushPromises()
    return wrapper
  }

  it('shows the notice when signed out', async () => {
    const wrapper = await open()
    expect(wrapper.find('[data-testid="assist-signed-out-notice"]').exists()).toBe(true)
  })

  it('hides the notice once there is a session', async () => {
    getAccessToken.mockReturnValue('a-token')
    const wrapper = await open()
    expect(wrapper.find('[data-testid="assist-signed-out-notice"]').exists()).toBe(false)
  })

  it('caps the input at the server limit', async () => {
    const wrapper = await open()
    expect(wrapper.find('[data-testid="assist-input"]').attributes('maxlength'))
      .toBe(String(SERVER_LIMIT))
  })

  it('leaves a signed-in user uncapped', async () => {
    // The cap belongs to the anonymous turn. A signed-in user pasting an
    // article into the box must not be truncated by a stale attribute.
    getAccessToken.mockReturnValue('a-token')
    const wrapper = await open()
    expect(wrapper.find('[data-testid="assist-input"]').attributes('maxlength'))
      .toBeUndefined()
  })

  it('stays quiet until the message approaches the cap', async () => {
    const wrapper = await open()
    await wrapper.find('[data-testid="assist-input"]').setValue('short question')
    expect(wrapper.find('[data-testid="assist-charcount"]').exists()).toBe(false)
  })

  it('counts down once the message is close to the cap', async () => {
    const wrapper = await open()
    await wrapper.find('[data-testid="assist-input"]').setValue('x'.repeat(SERVER_LIMIT - 10))
    const counter = wrapper.find('[data-testid="assist-charcount"]')
    expect(counter.exists()).toBe(true)
    expect(counter.text()).toBe(`${SERVER_LIMIT - 10}/${SERVER_LIMIT}`)
  })

  it('never shows a counter to a signed-in user', async () => {
    getAccessToken.mockReturnValue('a-token')
    const wrapper = await open()
    await wrapper.find('[data-testid="assist-input"]').setValue('x'.repeat(SERVER_LIMIT * 2))
    expect(wrapper.find('[data-testid="assist-charcount"]').exists()).toBe(false)
  })
})
