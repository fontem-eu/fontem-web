/**
 * Empty-state CTA on /my-stories.
 *
 * The empty state is the first thing a freshly-registered user sees
 * after they sign in — the prior copy ("No reports yet. Start your
 * first analysis above.") was technically correct but offered no
 * onward path for visitors who want to explore before creating.
 * The new CTA links to / (the Stories landing) so they can read
 * what others published.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  listReports: vi.fn(() => Promise.resolve([])),
  createReport: vi.fn(),
}))

import MyReportsView from '../../src/views/MyReportsView.vue'
import { listReports } from '../../src/api/community.js'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/my-stories', component: MyReportsView },
      { path: '/', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  await router.push('/my-stories')
  await router.isReady()
  const wrapper = mount(MyReportsView, {
    global: { plugins: [router, makeTestI18n()] },
  })
  await flushPromises()
  return wrapper
}

describe('MyReportsView empty state', () => {
  beforeEach(() => {
    listReports.mockReset()
    listReports.mockResolvedValue([])
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the empty-state CTA when the user has no reports', async () => {
    const wrapper = await mountView()
    const cta = wrapper.find('[data-testid="my-stories-empty-cta"]')
    expect(cta.exists()).toBe(true)
    expect(cta.attributes('href')).toBe('/')
  })

  it('does not render the CTA when the user already has reports', async () => {
    listReports.mockResolvedValueOnce([
      { id: 'r1', title: 'Existing report', visibility: 'private' },
    ])
    const wrapper = await mountView()
    expect(wrapper.find('[data-testid="my-stories-empty-cta"]').exists()).toBe(false)
  })
})
