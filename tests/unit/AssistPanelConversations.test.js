import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'

/**
 * Several conversations, each its own topic.
 *
 * The storage always allowed this; the panel only ever used two keys —
 * `report:<id>` and `global`. Now a signed-in user can start, switch, rename
 * and delete chats.
 *
 * The rule the tests exist to protect is segregation: switching drops what is
 * on screen before the new history lands. Chats that bleed into one another
 * are worse than one long chat, because the switcher then implies an isolation
 * that is not there.
 *
 * Mounted with a real Teleport — the stub re-creates slot content on every
 * re-render, which makes any DOM assertion unreliable.
 */
const list = vi.fn()
const create = vi.fn()
const rename = vi.fn()
const remove = vi.fn()
const page = vi.fn()

vi.mock('../../src/api/community.js', () => ({
  getAssistConversation: vi.fn().mockResolvedValue({ messages: [] }),
  getAssistConversationPage: (...a) => page(...a),
  listAssistConversations: (...a) => list(...a),
  createAssistConversation: (...a) => create(...a),
  renameAssistConversation: (...a) => rename(...a),
  deleteAssistConversation: (...a) => remove(...a),
  getAssistUsage: vi.fn().mockResolvedValue({ tokens_1h: 0, tokens_24h: 0, tokens_7d: 0 }),
  listAssistantModels: vi.fn().mockResolvedValue({ models: [], selected: '', active: true }),
}))
vi.mock('../../src/composables/useEditProposals.js', () => ({
  validateProposal: vi.fn(() => ({ valid: false })),
  executeProposal: vi.fn(),
}))
const token = vi.fn(() => 'a-token')
vi.mock('../../src/api/session.js', () => ({ getAccessToken: () => token() }))

const CONVERSATIONS = [
  { conversation_key: 'chat:aaa', title: 'Hungarian contracts', last_snippet: 'Seven companies.', message_count: 4, updated_at: '2026-08-25T10:00:00Z' },
  { conversation_key: 'chat:bbb', title: 'Sanctions', last_snippet: 'Nothing found.', message_count: 2, updated_at: '2026-08-24T10:00:00Z' },
]

const frame = () => new Promise((r) => requestAnimationFrame(() => r()))
const q = (sel) => document.querySelector(sel)
const all = (sel) => [...document.querySelectorAll(sel)]

let wrapper

async function open(props = {}) {
  wrapper = mount(AssistPanel, { props, attachTo: document.body })
  await flushPromises()
  q('[data-testid="assist-toggle"]').click()
  await flushPromises()
  await frame()
}

async function openSwitcher() {
  q('[data-testid="assist-conversation-switcher"]').click()
  await flushPromises()
}

describe('AssistPanel conversations', () => {
  beforeEach(() => {
    token.mockReturnValue('a-token')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, body: null })))
    list.mockReset(); create.mockReset(); rename.mockReset(); remove.mockReset(); page.mockReset()
    list.mockResolvedValue({ conversations: CONVERSATIONS })
    page.mockResolvedValue({ messages: [], has_more: false, next_before: '' })
    create.mockResolvedValue({
      conversation_key: 'chat:new', title: '', last_snippet: '', message_count: 0,
      updated_at: '2026-08-25T12:00:00Z',
    })
    rename.mockResolvedValue({})
    remove.mockResolvedValue({})
  })

  afterEach(() => {
    wrapper?.unmount()
    document.body.innerHTML = ''
  })

  it('offers a switcher to a signed-in user', async () => {
    await open()
    expect(q('[data-testid="assist-conversation-bar"]')).toBeTruthy()
  })

  it('hides the switcher from a signed-out visitor', async () => {
    // No account, so no list to switch between — one ephemeral thread.
    token.mockReturnValue(null)
    await open()
    expect(q('[data-testid="assist-conversation-bar"]')).toBeNull()
  })

  it("shows the switcher on a report's chat too", async () => {
    // The contract flipped deliberately (2026-08-28): the switcher used
    // to be absent on report pages, so a prompt sent while editing landed
    // in a chat invisible from everywhere else — "my prompt disappeared".
    // The report's chat is now the ACTIVE entry, not a cage.
    await open({ reportId: 'report-1' })
    expect(q('[data-testid="assist-conversation-bar"]')).not.toBeNull()
  })

  it('lists the conversations when opened', async () => {
    await open()
    await openSwitcher()
    expect(all('[data-testid="assist-conversation-row"]').length).toBe(2)
    expect(document.body.textContent).toContain('Hungarian contracts')
    expect(document.body.textContent).toContain('Sanctions')
  })

  it('loads the chosen conversation when switching', async () => {
    await open()
    await openSwitcher()
    all('[data-testid="assist-conversation-pick"]')[1].click()
    await flushPromises()
    expect(page).toHaveBeenLastCalledWith('chat:bbb', { limit: 30 })
  })

  it('does not carry messages from one chat into the next', async () => {
    // Segregation is the whole point of the switcher: if the previous
    // transcript lingers, the list implies an isolation that is not there.
    page.mockResolvedValueOnce({
      messages: [{ id: 'm1', role: 'user', content: 'about Hungary', created_at: 'x', extras: {} }],
      has_more: false, next_before: '',
    })
    await open()
    expect(document.body.textContent).toContain('about Hungary')

    page.mockResolvedValueOnce({ messages: [], has_more: false, next_before: '' })
    await openSwitcher()
    all('[data-testid="assist-conversation-pick"]')[1].click()
    await flushPromises()
    expect(document.body.textContent).not.toContain('about Hungary')
  })

  it('starts a new chat and switches to it', async () => {
    await open()
    q('[data-testid="assist-new-conversation"]').click()
    await flushPromises()
    expect(create).toHaveBeenCalled()
    expect(page).toHaveBeenLastCalledWith('chat:new', { limit: 30 })
  })

  it('renames a chat', async () => {
    await open()
    await openSwitcher()
    all('[data-testid="assist-conversation-rename"]')[0].click()
    await flushPromises()
    const input = q('[data-testid="assist-conversation-rename-input"]')
    input.value = 'Renamed'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    await flushPromises()
    expect(rename).toHaveBeenCalledWith('chat:aaa', 'Renamed')
  })

  it('one tap arms delete; only the second tap deletes', async () => {
    // Delete is irreversible and sits a thumb-width from Rename on a
    // phone. A single tap must never destroy a conversation.
    await open()
    await openSwitcher()
    all('[data-testid="assist-conversation-delete"]')[0].click()
    await flushPromises()
    expect(remove).not.toHaveBeenCalled()
    expect(all('[data-testid="assist-conversation-row"]').length).toBe(2)
    all('[data-testid="assist-conversation-delete"]')[0].click()
    await flushPromises()
    expect(remove).toHaveBeenCalledWith('chat:aaa')
    expect(all('[data-testid="assist-conversation-row"]').length).toBe(1)
  })

  it('rename focuses the input and selects the old name', async () => {
    // On a phone there is no second gesture to place the caret; the tap
    // on the pencil must land the user typing.
    await open()
    await openSwitcher()
    all('[data-testid="assist-conversation-rename"]')[0].click()
    await flushPromises()
    const input = q('[data-testid="assist-conversation-rename-input"]')
    expect(document.activeElement).toBe(input)
    expect(input.selectionEnd - input.selectionStart).toBe(input.value.length)
  })

  it('the armed delete says so in words, not just a colour', async () => {
    // :title tooltips do not exist on a touch screen — a silently red
    // icon reads as "the button is broken".
    await open()
    await openSwitcher()
    all('[data-testid="assist-conversation-delete"]')[0].click()
    await flushPromises()
    expect(all('[data-testid="assist-conversation-delete"]')[0].textContent)
      .toContain('Tap again to delete')
  })

  it('arming one row does not arm the others', async () => {
    await open()
    await openSwitcher()
    all('[data-testid="assist-conversation-delete"]')[0].click()
    await flushPromises()
    // Second tap lands on the OTHER row: it arms that one, deletes nothing.
    all('[data-testid="assist-conversation-delete"]')[1].click()
    await flushPromises()
    expect(remove).not.toHaveBeenCalled()
  })

  it('tapping outside the sheet closes it', async () => {
    await open()
    await openSwitcher()
    q('.assist-conv-backdrop').click()
    await flushPromises()
    expect(q('[data-testid="assist-conversation-list"]')).toBeFalsy()
  })

  it('falls back to the shared chat after deleting the one on screen', async () => {
    await open()
    await openSwitcher()
    all('[data-testid="assist-conversation-pick"]')[0].click()
    await flushPromises()
    await openSwitcher()
    const del = () => all('[data-testid="assist-conversation-delete"]')[0].click()
    del(); await flushPromises(); del()
    await flushPromises()
    // Not an empty panel with no way out.
    expect(page).toHaveBeenLastCalledWith('global', { limit: 30 })
  })
})

describe('AssistPanel conversations on a report page', () => {
  beforeEach(() => {
    token.mockReturnValue('a-token')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, body: null })))
    list.mockReset(); page.mockReset()
    list.mockResolvedValue({ conversations: CONVERSATIONS })
    page.mockResolvedValue({ messages: [], has_more: false, next_before: '' })
  })

  afterEach(() => {
    wrapper?.unmount()
    document.body.innerHTML = ''
  })

  it("defaults to the report's own chat", async () => {
    await open({ reportId: 'report-1' })
    q('[data-testid="assist-input"]') // panel is open
    // The active key drives the request the next prompt would use; the
    // page fetch for history names the report's chat.
    const keys = page.mock.calls.map((c) => c[0])
    expect(keys).toContain('report:report-1')
  })

  it('can switch away to another chat and load ITS history', async () => {
    // The other half of the "my prompt disappeared" fix: from a report
    // page the user can reach every chat, so nothing they wrote is ever
    // stranded somewhere invisible.
    await open({ reportId: 'report-1' })
    await openSwitcher()
    const rows = all('[data-testid="assist-conversation-pick"]')
    expect(rows.length).toBeGreaterThan(0)
    page.mockClear()
    rows[0].click()
    await flushPromises()
    const keys = page.mock.calls.map((c) => c[0])
    expect(keys).toContain('chat:aaa')
  })
})
