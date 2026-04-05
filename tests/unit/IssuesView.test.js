import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import IssuesView from '../../src/views/IssuesView.vue'
import * as communityApi from '../../src/api/community.js'

const IssueCreateModalStub = {
  name: 'IssueCreateModal',
  template: '<div v-if="visible" data-testid="issue-modal" />',
  props: ['visible'],
  emits: ['close', 'created'],
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/issues', component: IssuesView },
      { path: '/issues/:id', component: { template: '<div />' } },
    ],
  })
}

async function mountView(issues = []) {
  vi.spyOn(communityApi, 'listIssues').mockResolvedValue(issues)
  const router = makeRouter()
  await router.push('/issues')
  await router.isReady()
  const wrapper = mount(IssuesView, {
    global: {
      plugins: [router],
      stubs: { IssueCreateModal: IssueCreateModalStub },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('IssuesView', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows empty message when no issues exist', async () => {
    const { wrapper } = await mountView([])
    expect(wrapper.find('[data-testid="issues-empty"]').exists()).toBe(true)
  })

  it('renders issue items when issues exist', async () => {
    const { wrapper } = await mountView([
      { id: '1', title: 'Bug Report', status: 'open', entity_type: 'company', entity_id: 'x', vote_count: 3, comment_count: 1, created_at: '2026-01-01' },
      { id: '2', title: 'Missing Data', status: 'resolved', entity_type: 'authority', entity_id: 'y', vote_count: 0, comment_count: 0, created_at: '2026-02-01' },
    ])
    const items = wrapper.findAll('[data-testid="issues-item"]')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('Bug Report')
    expect(wrapper.text()).toContain('Missing Data')
  })

  it('shows status pills', async () => {
    const { wrapper } = await mountView([
      { id: '1', title: 'Open Issue', status: 'open' },
    ])
    expect(wrapper.find('.pill-open').exists()).toBe(true)
  })

  it('filters by tab', async () => {
    const { wrapper } = await mountView([
      { id: '1', title: 'Open', status: 'open' },
      { id: '2', title: 'Resolved', status: 'resolved' },
    ])
    // Click "Open" tab
    await wrapper.find('[data-testid="issues-tab-open"]').trigger('click')
    await flushPromises()
    const items = wrapper.findAll('[data-testid="issues-item"]')
    expect(items).toHaveLength(1)
    // Only the open issue should appear as an item
    const itemTexts = items.map((i) => i.text())
    expect(itemTexts[0]).toContain('Open')
    expect(itemTexts[0]).not.toContain('Resolved')
  })

  it('shows all issues on "All" tab', async () => {
    const { wrapper } = await mountView([
      { id: '1', title: 'Open', status: 'open' },
      { id: '2', title: 'Resolved', status: 'resolved' },
    ])
    await wrapper.find('[data-testid="issues-tab-open"]').trigger('click')
    await wrapper.find('[data-testid="issues-tab-all"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="issues-item"]')).toHaveLength(2)
  })

  it('opens create modal on button click', async () => {
    const { wrapper } = await mountView([])
    await wrapper.find('[data-testid="issues-raise-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="issue-modal"]').exists()).toBe(true)
  })

  it('shows error on API failure', async () => {
    vi.spyOn(communityApi, 'listIssues').mockRejectedValue(new Error('Failed'))
    const router = makeRouter()
    await router.push('/issues')
    await router.isReady()
    const wrapper = mount(IssuesView, {
      global: { plugins: [router], stubs: { IssueCreateModal: IssueCreateModalStub } },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="issues-error"]').exists()).toBe(true)
  })
})
