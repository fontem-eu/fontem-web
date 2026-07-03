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
  listVisualizations: vi.fn(),
  deleteInvestigation: vi.fn(),
}))

vi.mock('../../src/api/studio.js', () => ({
  listProjectsForInvestigation: vi.fn(),
  detachProject: vi.fn(),
}))

import InvestigationDetailView from '../../src/views/InvestigationDetailView.vue'
import {
  getInvestigation, listInvestigationMembers,
  addInvestigationMember, updateInvestigationMember, removeInvestigationMember,
  listInvestigationStories, removeInvestigationStory,
  listVisualizations, deleteInvestigation,
} from '../../src/api/community.js'
import { listProjectsForInvestigation, detachProject } from '../../src/api/studio.js'

const MEMBERS = [
  { user_id: 'u1', email: 'owner@x.io', role: 'owner' },
  { user_id: 'u2', email: 'mate@x.io', role: 'contributor' },
]

async function mountDetail(membership) {
  getInvestigation.mockResolvedValue({ id: 'i1', name: 'Panama', description: 'd', membership })
  listInvestigationMembers.mockResolvedValue(MEMBERS)
  if (!listInvestigationStories.getMockImplementation()) listInvestigationStories.mockResolvedValue([])
  if (!listVisualizations.getMockImplementation()) listVisualizations.mockResolvedValue([])
  if (!listProjectsForInvestigation.getMockImplementation()) listProjectsForInvestigation.mockResolvedValue([])
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
  const w = mount(InvestigationDetailView, { global: { plugins: [router, makeTestI18n()], stubs: { PipelineEmbed: true } } })
  await flushPromises()
  return w
}

beforeEach(() => {
  for (const m of [getInvestigation, listInvestigationMembers, addInvestigationMember, updateInvestigationMember, removeInvestigationMember, listInvestigationStories, removeInvestigationStory, listVisualizations, deleteInvestigation, listProjectsForInvestigation, detachProject]) m.mockReset()
})

describe('InvestigationDetailView', () => {
  it('renders title + members with emails', async () => {
    const w = await mountDetail({ role: 'owner' })
    expect(w.find('[data-testid="investigation-title"]').text()).toBe('Panama')
    expect(w.text()).toContain('owner@x.io')
    expect(w.text()).toContain('mate@x.io')
  })

  it('owner/admin sees the invite form; plain member does not', async () => {
    const manage = await mountDetail({ role: 'admin' })
    expect(manage.find('[data-testid="investigation-invite"]').exists()).toBe(true)
    const viewer = await mountDetail({ role: 'viewer' })
    expect(viewer.find('[data-testid="investigation-invite"]').exists()).toBe(false)
  })

  it('invites by email with a role', async () => {
    addInvestigationMember.mockResolvedValue({})
    const w = await mountDetail({ role: 'owner' })
    await w.find('[data-testid="invite-email-input"]').setValue('new@x.io')
    await w.find('[data-testid="invite-role"]').setValue('contributor')
    await w.find('[data-testid="invite-add-btn"]').trigger('click')
    await flushPromises()
    expect(addInvestigationMember).toHaveBeenCalledWith('i1', expect.objectContaining({ email: 'new@x.io', role: 'contributor' }))
  })

  it('changes a member role', async () => {
    updateInvestigationMember.mockResolvedValue({})
    const w = await mountDetail({ role: 'owner' })
    await w.find('[data-testid="member-role-select-u2"]').setValue('admin')
    await flushPromises()
    expect(updateInvestigationMember).toHaveBeenCalledWith('i1', 'u2', { role: 'admin' })
  })

  it('removes a member', async () => {
    removeInvestigationMember.mockResolvedValue({})
    const w = await mountDetail({ role: 'owner' })
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
    const w = await mountDetail({ role: 'owner' })
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
    const w = await mountDetail({ role: 'viewer' })
    expect(w.find('[data-testid="inv-story-s1"]').exists()).toBe(true)
    expect(w.find('[data-testid="inv-story-remove-s1"]').exists()).toBe(false)
  })
})

describe('InvestigationDetailView — viz list + delete', () => {
  it('lists the investigation visualizations', async () => {
    listVisualizations.mockResolvedValue([{ id: 'v1', name: 'Cohesion chart', widget_type: 'chart_snapshot' }])
    const w = await mountDetail({ role: 'viewer' })
    expect(w.find('[data-testid="investigation-viz"]').exists()).toBe(true)
    expect(w.find('[data-testid="inv-viz-v1"]').exists()).toBe(true)
    expect(w.text()).toContain('Cohesion chart')
  })

  it('owner sees Delete; viewer does not', async () => {
    const owner = await mountDetail({ role: 'owner' })
    expect(owner.find('[data-testid="investigation-delete-btn"]').exists()).toBe(true)
    const viewer = await mountDetail({ role: 'viewer' })
    expect(viewer.find('[data-testid="investigation-delete-btn"]').exists()).toBe(false)
  })

  it('delete with cascade/orphan calls deleteInvestigation', async () => {
    deleteInvestigation.mockResolvedValue({})
    const w = await mountDetail({ role: 'owner' })
    await w.find('[data-testid="investigation-delete-btn"]').trigger('click')
    expect(w.find('[data-testid="investigation-delete-confirm"]').exists()).toBe(true)
    await w.find('[data-testid="investigation-delete-orphan"]').trigger('click')
    await flushPromises()
    expect(deleteInvestigation).toHaveBeenCalledWith('i1', 'orphan')
  })
  it('lists shared data projects and renders their plots inline', async () => {
    listProjectsForInvestigation.mockResolvedValue([
      { id: 'dp1', name: 'Single-bidder', investigation_id: 'i1',
        queries: [{ id: 'q1' }],
        plots: [{ id: 'pl1', name: 'By country', spec: { sources: [], transform: '', chart: 'bar_h' } }] },
    ])
    const w = await mountDetail({ role: 'contributor' })
    const sec = w.find('[data-testid="investigation-data-projects"]')
    expect(sec.exists()).toBe(true)
    expect(w.find('[data-testid="inv-dp-dp1"]').text()).toContain('Single-bidder')
    expect(w.find('[data-testid="inv-dp-open-dp1"]').attributes('href')).toContain('/studio/p/dp1')
    // the saved plot is rendered inline via the pipeline embed
    expect(w.find('[data-testid="inv-dp-plot-pl1"]').exists()).toBe(true)
    // the pocket config forwards the full spec (line/corr/bivariate fields), not just chart/x/y
    const embed = w.findComponent({ name: 'PipelineEmbed' })
    const up = embed.props('config').ui_params
    expect(up).toMatchObject({ chart: 'bar_h', bivariate: 'none' })
    expect(up).toHaveProperty('series')
    expect(up).toHaveProperty('corrCols')
    // a contributor can detach it
    await w.find('[data-testid="inv-dp-detach-dp1"]').trigger('click'); await flushPromises()
    expect(detachProject).toHaveBeenCalledWith('dp1')
  })

})
