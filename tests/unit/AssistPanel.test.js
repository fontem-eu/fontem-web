import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AssistPanel from '../../src/components/AssistPanel.vue'

// Mock the community API
vi.mock('../../src/api/community.js', () => ({
  getConversation: vi.fn().mockResolvedValue(null),
  saveConversation: vi.fn().mockResolvedValue({}),
}))

// Mock useEditProposals
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

  it('loads conversation on mount when reportId is set', async () => {
    const { getConversation } = await import('../../src/api/community.js')
    expect(getConversation).toHaveBeenCalledWith('report-1')
  })

  it('restores persisted messages from conversation API', async () => {
    const { getConversation } = await import('../../src/api/community.js')
    getConversation.mockResolvedValueOnce({
      id: 'conv-1',
      report_id: 'report-1',
      messages: [
        { role: 'user', text: 'Hello' },
        { role: 'assistant', text: 'Hi there' },
      ],
      updated_at: '2026-01-01T00:00:00Z',
    })

    const w = mount(AssistPanel, {
      props: { reportContext: 'Test', reportId: 'report-2' },
    })
    await flushPromises()
    await w.find('[data-testid="assist-toggle"]').trigger('click')

    const msgs = w.findAll('.assist-msg')
    expect(msgs.length).toBe(2)
  })
})
