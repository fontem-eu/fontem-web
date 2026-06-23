import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  getInvestigation: vi.fn(),
  updateInvestigation: vi.fn(),
  listInvestigationMembers: vi.fn(),
  addInvestigationMember: vi.fn(),
  updateInvestigationMember: vi.fn(),
  removeInvestigationMember: vi.fn(),
  listInvestigationStories: vi.fn(),
  removeInvestigationStory: vi.fn(),
}))

import InvestigationDetailView from '../../src/views/InvestigationDetailView.vue'
import {
  getInvestigation, listInvestigationMembers,
  addInvestigationMember, updateInvestigationMember, removeInvestigationMember,
  listInvestigationStories, removeInvestigationStory,
} from '../../src/api/community.js'

const MEMBERS = [
  { user_id: 'u1', email: 'owner@x.io', is_owner: true, can_write_stories: true, can_add_viz: true, can_administer: true },
  { user_id: 'u2', email: 'mate@x.io', can_write_stories: true, can_add_viz: false, can_administer: false, is_owner: false },
]

async function mountDetail(membership) {
  getInvestigation.mockResolvedValue({ id: 'i1', name: 'Panama', description: 'd', membership })
  listInvestigationMembers.mockResolvedValue(MEMBERS)
  if (!listInvestigationStories.getMockImplementation()) listInvestigationStories.mockResolvedValue([])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/investigations', component: { template: '<div />' } },
      { path: '/investigations/:id', component: InvestigationDetailView },
      { path: '/stories/:id', component: { template: '<div />' } },
    ],
  })
  await router.push('/investigations/i1')
  await router.isReady()
  const w = mount(InvestigationDetailView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return w
}

beforeEach(() => {
  for (const m of [getInvestigation, listInvestigationMembers, addInvestigationMember, updateInvestigationMember, removeInvestigationMember, listInvestigationStories, removeInvestigationStory]) m.mockReset()
})

describe('InvestigationDetailView', () => {
  it('renders title + members with emails', async () => {
    const w = await mountDetail({ is_owner: true, can_administer: true })
    expect(w.find('[data-testid="investigation-title"]').text()).toBe('Panama')
    expect(w.text()).toContain('owner@x.io')
    expect(w.text()).toContain('mate@x.io')
  })

  it('owner/admin sees the invite form; plain member does not', async () => {
    const manage = await mountDetail({ can_administer: true })
    expect(manage.find('[data-testid="investigation-invite"]').exists()).toBe(true)
    const viewer = await mountDetail({ can_write_stories: false })
    expect(viewer.find('[data-testid="investigation-invite"]').exists()).toBe(false)
  })

  it('invites by email with caps', async () => {
    addInvestigationMember.mockResolvedValue({})
    const w = await mountDetail({ is_owner: true, can_administer: true })
    await w.find('[data-testid="invite-email-input"]').setValue('new@x.io')
    await w.find('[data-testid="invite-write"]').setValue(true)
    await w.find('[data-testid="invite-add-btn"]').trigger('click')
    await flushPromises()
    expect(addInvestigationMember).toHaveBeenCalledWith('i1', expect.objectContaining({ email: 'new@x.io', can_write_stories: true }))
  })

  it('toggles a member capability', async () => {
    updateInvestigationMember.mockResolvedValue({})
    const w = await mountDetail({ is_owner: true, can_administer: true })
    await w.find('[data-testid="cap-can_add_viz-u2"]').trigger('change')
    await flushPromises()
    expect(updateInvestigationMember).toHaveBeenCalledWith('i1', 'u2', expect.objectContaining({ can_add_viz: true }))
  })

  it('removes a member', async () => {
    removeInvestigationMember.mockResolvedValue({})
    const w = await mountDetail({ is_owner: true, can_administer: true })
    await w.find('[data-testid="remove-u2"]').trigger('click')
    await flushPromises()
    expect(removeInvestigationMember).toHaveBeenCalledWith('i1', 'u2')
  })

  it('lists associated stories and removes one (write-capable)', async () => {
    listInvestigationStories.mockResolvedValue([
      { id: 's1', title: 'Follow the money' },
      { id: 's2', title: 'Shell layers' },
    ])
    removeInvestigationStory.mockResolvedValue({})
    // after removal, the list refetches without s1
    const w = await mountDetail({ is_owner: true, can_write_stories: true, can_administer: true })
    expect(w.find('[data-testid="investigation-stories"]').exists()).toBe(true)
    expect(w.find('[data-testid="inv-story-s1"]').exists()).toBe(true)
    expect(w.text()).toContain('Follow the money')

    listInvestigationStories.mockResolvedValue([{ id: 's2', title: 'Shell layers' }])
    await w.find('[data-testid="inv-story-remove-s1"]').trigger('click')
    await flushPromises()
    expect(removeInvestigationStory).toHaveBeenCalledWith('i1', 's1')
    expect(w.find('[data-testid="inv-story-s1"]').exists()).toBe(false)
  })

  it('hides the story remove button for non-write members', async () => {
    listInvestigationStories.mockResolvedValue([{ id: 's1', title: 'X' }])
    const w = await mountDetail({ is_owner: false, can_write_stories: false, can_administer: false })
    expect(w.find('[data-testid="inv-story-s1"]').exists()).toBe(true)
    expect(w.find('[data-testid="inv-story-remove-s1"]').exists()).toBe(false)
  })
})
