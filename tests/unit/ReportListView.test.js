import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ReportListView from '../../src/views/ReportListView.vue'
import * as communityApi from '../../src/api/community.js'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/reports', component: ReportListView },
      { path: '/reports/:id/edit', component: { template: '<div />' } },
    ],
  })
}

async function mountView(reports = []) {
  vi.spyOn(communityApi, 'listReports').mockResolvedValue(reports)
  const router = makeRouter()
  await router.push('/reports')
  await router.isReady()
  const wrapper = mount(ReportListView, {
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('ReportListView', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows empty message when no reports exist', async () => {
    const { wrapper } = await mountView([])
    expect(wrapper.find('[data-testid="report-list-empty"]').exists()).toBe(true)
  })

  it('renders report cards when reports exist', async () => {
    const { wrapper } = await mountView([
      { id: '1', title: 'Report One', abstract: 'Abstract', visibility: 'private', created_at: '2026-01-01' },
      { id: '2', title: 'Report Two', abstract: 'Another', visibility: 'public', created_at: '2026-02-01' },
    ])
    expect(wrapper.findAll('.report-card')).toHaveLength(2)
    expect(wrapper.text()).toContain('Report One')
    expect(wrapper.text()).toContain('Report Two')
  })

  it('shows "Start a new analysis" button when authenticated', async () => {
    localStorage.setItem('gmr-token', 'test')
    const { wrapper } = await mountView([])
    expect(wrapper.find('[data-testid="new-report-btn"]').exists()).toBe(true)
    localStorage.clear()
  })

  it('hides "Start a new analysis" button when not authenticated', async () => {
    localStorage.clear()
    const { wrapper } = await mountView([])
    expect(wrapper.find('[data-testid="new-report-btn"]').exists()).toBe(false)
  })

  it('shows error message on API failure', async () => {
    vi.spyOn(communityApi, 'listReports').mockRejectedValue(new Error('Network error'))
    const router = makeRouter()
    await router.push('/reports')
    await router.isReady()
    const wrapper = mount(ReportListView, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.find('[data-testid="report-list-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Network error')
  })

  it('truncates long abstracts', async () => {
    const longAbstract = 'A'.repeat(200)
    const { wrapper } = await mountView([
      { id: '1', title: 'R', abstract: longAbstract, visibility: 'private' },
    ])
    expect(wrapper.text()).not.toContain(longAbstract)
    expect(wrapper.text()).toContain('...')
  })

  it('shows visibility badges', async () => {
    const { wrapper } = await mountView([
      { id: '1', title: 'R', visibility: 'public' },
    ])
    expect(wrapper.find('.badge-public').exists()).toBe(true)
  })

  it('creates a new report and navigates to editor', async () => {
    localStorage.setItem('gmr-token', 'test')
    vi.spyOn(communityApi, 'createReport').mockResolvedValue({ id: 'new-123' })
    const { wrapper, router } = await mountView([])
    const pushSpy = vi.spyOn(router, 'push')
    await wrapper.find('[data-testid="new-report-btn"]').trigger('click')
    await flushPromises()
    expect(pushSpy).toHaveBeenCalledWith('/reports/new-123/edit')
    localStorage.clear()
  })
})
