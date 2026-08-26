import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'

// Mock the community API — the assistant module owns history server-side,
// so the frontend only reads it via getAssistConversationPage.
vi.mock('../../src/api/community.js', () => ({
  getAssistConversation: vi.fn().mockResolvedValue(null),
  getAssistConversationPage: vi.fn().mockResolvedValue(null),
  getAssistUsage: vi.fn().mockResolvedValue({
    tokens_1h: 0, tokens_24h: 0, tokens_7d: 0,
  }),
}))

vi.mock('../../src/composables/useEditProposals.js', () => ({
  validateProposal: vi.fn(() => ({ valid: false })),
  executeProposal: vi.fn(),
}))

describe('AssistPanel', () => {
  let wrapper

  beforeEach(() => {
    wrapper = mount(AssistPanel, {
      props: {
        reportContext: 'Test Report',
        reportId: 'report-1',
      },
      // The overlay is teleported to <body> so a hidden ancestor cannot
      // stop it rendering (ReportEditorView mounts this inside
      // .secondary-controls, which is display:none below 640px). Stub
      // Teleport so it renders inline and these assertions can keep
      // using wrapper.find; the teleport itself is asserted separately
      // below, and the real-viewport behaviour by ASSIST-PRE-19.
      global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
    })
  })

  it('renders toggle button', () => {
    expect(wrapper.find('[data-testid="assist-toggle"]').exists()).toBe(true)
  })

  it('panel is hidden by default', () => {
    expect(wrapper.find('[data-testid="assist-panel"]').exists()).toBe(false)
  })

  it('opens panel when toggle is clicked', async () => {
    await wrapper.find('[data-testid="assist-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="assist-panel"]').exists()).toBe(true)
  })

  it('has a close button that closes the panel', async () => {
    await wrapper.find('[data-testid="assist-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="assist-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="assist-close"]').trigger('click')
    expect(wrapper.find('[data-testid="assist-panel"]').exists()).toBe(false)
  })

  it('has backdrop for mobile close', async () => {
    await wrapper.find('[data-testid="assist-toggle"]').trigger('click')
    const backdrop = wrapper.find('.assist-backdrop')
    expect(backdrop.exists()).toBe(true)

    await backdrop.trigger('click')
    expect(wrapper.find('[data-testid="assist-panel"]').exists()).toBe(false)
  })

  it('shows empty state message when no messages', async () => {
    await wrapper.find('[data-testid="assist-toggle"]').trigger('click')
    expect(wrapper.find('.assist-empty').exists()).toBe(true)
  })

  it('loads conversation on mount using a report-scoped conversation key', async () => {
    const { getAssistConversationPage } = await import('../../src/api/community.js')
    expect(getAssistConversationPage).toHaveBeenCalledWith(
      'report:report-1', { limit: 30 },
    )
  })

  it('restores persisted messages from the assistant module', async () => {
    const { getAssistConversationPage } = await import('../../src/api/community.js')
    getAssistConversationPage.mockResolvedValueOnce({
      conversation_key: 'report:report-2',
      messages: [
        { role: 'user', content: 'Hello', created_at: '2026-01-01T00:00:00Z' },
        { role: 'assistant', content: 'Hi there', created_at: '2026-01-01T00:00:01Z' },
      ],
    })

    const w = mount(AssistPanel, {
      props: { reportContext: 'Test', reportId: 'report-2' },
      global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()
    await w.find('[data-testid="assist-toggle"]').trigger('click')

    const msgs = w.findAll('.assist-msg')
    expect(msgs.length).toBe(2)
  })
})

describe('AssistPanel — accept-all / bypass-permissions toggle', () => {
  const BYPASS_KEY = 'fontem-assist-bypass-permissions'

  beforeEach(() => {
    localStorage.removeItem(BYPASS_KEY)
  })

  function open(wrapper) {
    return wrapper.find('[data-testid="assist-toggle"]').trigger('click')
  }

  it('toggle is off by default and the checkbox is unchecked', async () => {
    const w = mount(AssistPanel, {
      props: { reportContext: 'r', reportId: 'r1' },
      global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()
    await open(w)
    const cb = w.find('[data-testid="assist-bypass-toggle"]')
    expect(cb.exists()).toBe(true)
    expect(cb.element.checked).toBe(false)
  })

  it('toggling on persists "1" to localStorage', async () => {
    const w = mount(AssistPanel, {
      props: { reportContext: 'r', reportId: 'r1' },
      global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()
    await open(w)
    await w.find('[data-testid="assist-bypass-toggle"]').setValue(true)
    expect(localStorage.getItem(BYPASS_KEY)).toBe('1')
  })

  it('toggling off clears the localStorage entry', async () => {
    localStorage.setItem(BYPASS_KEY, '1')
    const w = mount(AssistPanel, {
      props: { reportContext: 'r', reportId: 'r1' },
      global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()
    await open(w)
    const cb = w.find('[data-testid="assist-bypass-toggle"]')
    expect(cb.element.checked).toBe(true)
    await cb.setValue(false)
    expect(localStorage.getItem(BYPASS_KEY)).toBeNull()
  })

  it('mounts with toggle on when localStorage already set', async () => {
    localStorage.setItem(BYPASS_KEY, '1')
    const w = mount(AssistPanel, {
      props: { reportContext: 'r', reportId: 'r1' },
      global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
    })
    await flushPromises()
    await open(w)
    expect(w.find('[data-testid="assist-bypass-toggle"]').element.checked).toBe(true)
  })
})

describe('AssistPanel — overlay teleport', () => {
  /**
   * Regression: ReportEditorView renders <AssistPanel> inside
   * .secondary-controls, which is `display: none` below 640px unless the
   * kebab opens it. display:none on an ancestor stops a position:fixed
   * child rendering at all — the panel sat in the DOM with a 619px
   * computed height and a 0x0 bounding rect, so the input was
   * unreachable on mobile.
   */
  it('renders the panel under <body>, not inside the mount point', async () => {
    const w = mount(AssistPanel, {
      props: { reportContext: 'Test Report', reportId: 'report-1' },
      attachTo: document.body,
      global: { stubs: { Teleport: { template: '<div><slot /></div>' } } },
    })
    await w.find('[data-testid="assist-toggle"]').trigger('click')
    await flushPromises()
    const panel = document.body.querySelector('[data-testid="assist-panel"]')
    expect(panel).not.toBeNull()
    // Outside this component's own subtree — that subtree is what gets
    // hidden by the collapsible toolbar.
    expect(w.element.contains(panel)).toBe(false)
    w.unmount()
    document.body.innerHTML = ''
  })
})
