import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { i18n } from './helpers/i18n.js'
import ActivityView from '../../src/views/ActivityView.vue'

/**
 * The feed distinguishes what you did from what was done for you.
 *
 * An entry saying the user created a Data Studio project is false when the
 * assistant created it on their behalf, and the log carried nothing that
 * could tell the two apart. That matters most on a platform whose claim is
 * that things trace back to a source: the claim has to hold for the
 * platform's own actions too.
 */
const activity = vi.fn()
const profile = vi.fn()
vi.mock('../../src/api/community.js', () => ({
  listActivity: (...a) => activity(...a),
  getCurrentUser: (...a) => profile(...a),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../../src/api/session.js', () => ({ isAuthed: { value: true } }))

const EVENT = {
  id: 'a1', entity_type: 'data_project', entity_id: 'p1',
  action: 'created', summary: 'Russian suppliers',
  created_at: '2026-08-13T10:00:00Z',
}

async function view(events) {
  activity.mockResolvedValue(events)
  profile.mockResolvedValue({ id: 'u1', name: 'G' })
  const w = mount(ActivityView, { global: { plugins: [i18n] } })
  await flushPromises()
  return w
}

describe('activity provenance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks an entry the assistant produced', async () => {
    const w = await view([{ ...EVENT, actor_kind: 'agent', conversation_id: 'c1' }])
    expect(w.find('[data-testid="activity-by-agent"]').exists()).toBe(true)
  })

  it('leaves a directly-performed action unmarked', async () => {
    const w = await view([{ ...EVENT, actor_kind: 'user' }])
    expect(w.find('[data-testid="activity-by-agent"]').exists()).toBe(false)
  })

  it('treats an entry with no provenance as the user, not the agent', async () => {
    // The 29 rows written before the column existed.
    const w = await view([EVENT])
    expect(w.find('[data-testid="activity-by-agent"]').exists()).toBe(false)
  })

  it('still shows what was done', async () => {
    const w = await view([{ ...EVENT, actor_kind: 'agent' }])
    expect(w.text()).toContain('Russian suppliers')
    expect(w.text()).toContain('created')
  })
})
