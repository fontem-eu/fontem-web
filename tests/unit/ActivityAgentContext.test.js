import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { i18n } from './helpers/i18n.js'
import ActivityView from '../../src/views/ActivityView.vue'

/**
 * "The assistant did this" is a claim. This is the evidence.
 *
 * An agent-authored entry names the tool call that caused it; opening it
 * fetches the turn that call belonged to — what the user asked, everything
 * the agent did about it, and what it answered. Without that, a user is
 * asked to take the platform's word for what a model did on their behalf,
 * which is the opposite of what the audit trail is for.
 */
const activity = vi.fn()
const profile = vi.fn()
const context = vi.fn()
vi.mock('../../src/api/community.js', () => ({
  listActivity: (...a) => activity(...a),
  getCurrentUser: (...a) => profile(...a),
  getAgentContext: (...a) => context(...a),
}))
const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('../../src/api/session.js', () => ({ isAuthed: { value: true } }))

const AGENT_EVENT = {
  id: 'a1', entity_type: 'data_project', entity_id: 'p1',
  action: 'created', summary: 'Russian suppliers',
  created_at: '2026-08-14T10:00:00Z',
  actor_kind: 'agent', conversation_id: 'c1', message_id: 'call-2',
}

const TURN = {
  conversation_id: 'c1',
  message_id: 'call-2',
  prompt: { content: 'find me russian suppliers and save them' },
  calls: [
    { id: 'call-1', tool: 'mcp__gmr__search_entities', args: { query: 'Russia' }, is_subject: false },
    { id: 'call-2', tool: 'mcp__gmr__studio_create_project', args: { name: 'Russian suppliers' }, is_subject: true },
  ],
  answer: { content: 'I made you a project.', model: 'qwen3-4b' },
}

async function view(events = [AGENT_EVENT]) {
  activity.mockResolvedValue(events)
  profile.mockResolvedValue({ id: 'u1', name: 'G' })
  const w = mount(ActivityView, { global: { plugins: [i18n] } })
  await flushPromises()
  return w
}

describe('agent context', () => {
  beforeEach(() => { vi.clearAllMocks(); context.mockResolvedValue(TURN) })

  it('is closed until asked for', async () => {
    const w = await view()
    expect(w.find('[data-testid="agent-context"]').exists()).toBe(false)
    expect(context).not.toHaveBeenCalled()
  })

  it('fetches the turn using the tool call the entry names', async () => {
    const w = await view()
    await w.find('[data-testid="activity-by-agent"]').trigger('click')
    await flushPromises()
    expect(context).toHaveBeenCalledWith('call-2')
  })

  it('shows the prompt that caused it', async () => {
    const w = await view()
    await w.find('[data-testid="activity-by-agent"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="agent-context-prompt"]').text())
      .toContain('find me russian suppliers')
  })

  it('shows the whole tool sequence, not just the one call', async () => {
    // The project was created because a search came back first; the
    // sequence is what makes the action legible.
    const w = await view()
    await w.find('[data-testid="activity-by-agent"]').trigger('click')
    await flushPromises()
    const calls = w.findAll('[data-testid="agent-context-call"]')
    expect(calls).toHaveLength(2)
    expect(calls[0].text()).toContain('search_entities')
    expect(calls[1].text()).toContain('studio_create_project')
  })

  it('marks which call this entry came from', async () => {
    const w = await view()
    await w.find('[data-testid="activity-by-agent"]').trigger('click')
    await flushPromises()
    const marked = w.findAll('.agent-call--subject')
    expect(marked).toHaveLength(1)
    expect(marked[0].text()).toContain('studio_create_project')
  })

  it('shows the arguments the call was made with', async () => {
    const w = await view()
    await w.find('[data-testid="activity-by-agent"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="agent-context"]').text()).toContain('Russian suppliers')
  })

  it('shows the answer and the model that wrote it', async () => {
    const w = await view()
    await w.find('[data-testid="activity-by-agent"]').trigger('click')
    await flushPromises()
    const text = w.find('[data-testid="agent-context"]').text()
    expect(text).toContain('I made you a project.')
    expect(text).toContain('qwen3-4b')
  })

  it('closes again when clicked twice', async () => {
    const w = await view()
    const btn = w.find('[data-testid="activity-by-agent"]')
    await btn.trigger('click')
    await flushPromises()
    await btn.trigger('click')
    expect(w.find('[data-testid="agent-context"]').exists()).toBe(false)
  })

  it('does not refetch on reopen', async () => {
    const w = await view()
    const btn = w.find('[data-testid="activity-by-agent"]')
    await btn.trigger('click')
    await flushPromises()
    await btn.trigger('click')
    await btn.trigger('click')
    await flushPromises()
    expect(context).toHaveBeenCalledTimes(1)
  })

  it('says so when the conversation is gone rather than showing nothing', async () => {
    // Clearing a chat unlinks the activity on purpose; the entry survives
    // and this is the shape a user meets afterwards.
    context.mockRejectedValue(new Error('No such tool call'))
    const w = await view()
    await w.find('[data-testid="activity-by-agent"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="agent-context"]').text()).toMatch(/no longer available/i)
  })

  it('offers nothing to open on an entry the user performed', async () => {
    const w = await view([{ ...AGENT_EVENT, actor_kind: 'user', message_id: null }])
    expect(w.find('[data-testid="activity-by-agent"]').exists()).toBe(false)
  })

  it('opening the context does not navigate away', async () => {
    // A story entry HAS a link, so the row navigates on click. The button
    // sits inside that row and must not trigger it — otherwise asking why
    // the agent did something takes you somewhere else instead.
    const w = await view([{
      ...AGENT_EVENT, entity_type: 'story', entity_id: 's1', summary: 'A story',
    }])
    await w.find('[data-testid="activity-by-agent"]').trigger('click')
    await flushPromises()
    expect(push, 'clicking the agent chip navigated away').not.toHaveBeenCalled()
    expect(w.find('[data-testid="agent-context"]').exists()).toBe(true)
  })

  it('the row itself still navigates', async () => {
    // The other half: suppressing the button click must not suppress the row.
    const w = await view([{
      ...AGENT_EVENT, entity_type: 'story', entity_id: 's1', summary: 'A story',
    }])
    await w.find('[data-testid="activity-story-created"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/stories/s1')
  })
})
