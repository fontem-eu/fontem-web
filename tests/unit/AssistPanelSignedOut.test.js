import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'

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
