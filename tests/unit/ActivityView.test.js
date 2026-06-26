import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  listActivity: vi.fn(),
  getCurrentUser: vi.fn(),
}))
vi.mock('../../src/api/session.js', () => ({ isAuthed: { value: true } }))

import ActivityView from '../../src/views/ActivityView.vue'
import { listActivity, getCurrentUser } from '../../src/api/community.js'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/activity', component: ActivityView },
      { path: '/:rest(.*)', component: { template: '<div />' } },
    ],
  })
}
async function mountView() {
  const router = makeRouter()
  await router.push('/activity')
  await router.isReady()
  const w = mount(ActivityView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return { w, router }
}

beforeEach(() => {
  listActivity.mockReset()
  getCurrentUser.mockReset()
  getCurrentUser.mockResolvedValue({ name: 'Me' })
})

describe('ActivityView', () => {
  it('renders CUD events across all four entity types', async () => {
    listActivity.mockResolvedValue([
      { id: '1', entity_type: 'story', action: 'created', summary: 'My Story', created_at: '2026-06-25T10:00:00Z', entity_id: 's1' },
      { id: '2', entity_type: 'investigation', action: 'updated', summary: 'My Inv', created_at: '2026-06-25T09:00:00Z', entity_id: 'i1' },
      { id: '3', entity_type: 'dossier', action: 'created', summary: 'My Dossier', created_at: '2026-06-25T08:00:00Z', entity_id: 'd1' },
      { id: '4', entity_type: 'issue', action: 'deleted', summary: 'My Issue', created_at: '2026-06-25T07:00:00Z', entity_id: 'iss1' },
    ])
    const { w } = await mountView()
    expect(w.find('[data-testid="activity-list"]').exists()).toBe(true)
    expect(w.find('[data-testid="activity-story-created"]').exists()).toBe(true)
    expect(w.find('[data-testid="activity-investigation-updated"]').exists()).toBe(true)
    expect(w.find('[data-testid="activity-dossier-created"]').exists()).toBe(true)
    expect(w.find('[data-testid="activity-issue-deleted"]').exists()).toBe(true)
    expect(w.text()).toContain('My Story')
  })

  it('links non-deleted items; deleted items do not navigate', async () => {
    listActivity.mockResolvedValue([
      { id: '1', entity_type: 'story', action: 'created', summary: 'S', created_at: '2026-06-25T10:00:00Z', entity_id: 's1' },
      { id: '2', entity_type: 'dossier', action: 'deleted', summary: 'D', created_at: '2026-06-25T09:00:00Z', entity_id: 'd1' },
    ])
    const { w, router } = await mountView()
    const push = vi.spyOn(router, 'push')
    await w.find('[data-testid="activity-story-created"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/stories/s1')
    push.mockClear()
    await w.find('[data-testid="activity-dossier-deleted"]').trigger('click')
    expect(push).not.toHaveBeenCalled()
  })

  it('shows the empty state with no activity', async () => {
    listActivity.mockResolvedValue([])
    const { w } = await mountView()
    expect(w.find('[data-testid="activity-empty"]').exists()).toBe(true)
  })
})
