/**
 * FeedView — tag chip strip + URL-driven filter + follow toggle.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../../src/api/community.js', () => ({
  listReports: vi.fn(),
  listAllTags: vi.fn(),
  listFollowedTags: vi.fn(() => Promise.resolve({ tags: [] })),
  followTag: vi.fn((t) => Promise.resolve({ tag: t })),
  unfollowTag: vi.fn(() => Promise.resolve(null)),
}))

import * as api from '../../src/api/community.js'
import FeedView from '../../src/views/FeedView.vue'
import { _resetFollowedTagsForTests } from '../../src/composables/useFollowedTags.js'

const STORIES_ALL = [
  { id: 'a', title: 'A', abstract: '', updated_at: '2026-04-01', tags: ['procurement'] },
  { id: 'b', title: 'B', abstract: '', updated_at: '2026-04-02', tags: ['lobbying'] },
]
const STORIES_PROC = [STORIES_ALL[0]]

const TAGS = [
  { tag: 'procurement', story_count: 1 },
  { tag: 'lobbying', story_count: 1 },
]

beforeEach(() => {
  localStorage.clear()
  _resetFollowedTagsForTests()
  vi.clearAllMocks()
  api.listReports.mockResolvedValue(STORIES_ALL)
  api.listAllTags.mockResolvedValue({ tags: TAGS })
})

afterEach(() => vi.restoreAllMocks())

async function mountFeed(initialPath = '/feed') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/feed', component: FeedView },
      { path: '/stories/:id', component: { template: '<div />' } },
    ],
  })
  await router.push(initialPath)
  await router.isReady()
  const wrapper = mount(FeedView, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

describe('FeedView', () => {
  it('renders one chip per tag with story counts', async () => {
    const { wrapper } = await mountFeed()
    expect(wrapper.find('[data-testid="tag-chip-procurement"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tag-chip-lobbying"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tag-chip-procurement"]').text()).toContain('1')
    wrapper.unmount()
  })

  it('clicking a chip writes ?tag= and refetches the filtered list', async () => {
    const { wrapper } = await mountFeed()
    api.listReports.mockResolvedValueOnce(STORIES_PROC)

    await wrapper.find('[data-testid="tag-chip-procurement"]').trigger('click')
    await flushPromises()

    // Last listReports call passed `tag: 'procurement'`.
    const lastCall = api.listReports.mock.calls[api.listReports.mock.calls.length - 1][0]
    expect(lastCall).toMatchObject({ tag: 'procurement' })
    // Active-filter banner appears.
    expect(wrapper.find('[data-testid="feed-active-filter"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('clicking the All chip clears the filter', async () => {
    const { wrapper } = await mountFeed('/feed?tag=procurement')
    await wrapper.find('[data-testid="tag-chip-all"]').trigger('click')
    await flushPromises()
    const lastCall = api.listReports.mock.calls[api.listReports.mock.calls.length - 1][0]
    expect(lastCall).not.toHaveProperty('tag', 'procurement')
    expect(wrapper.find('[data-testid="feed-active-filter"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders a follow star per chip and toggles localStorage when clicked (unauth)', async () => {
    const { wrapper } = await mountFeed()
    expect(wrapper.find('[data-testid="tag-follow-procurement"]').text()).toBe('☆')
    await wrapper.find('[data-testid="tag-follow-procurement"]').trigger('click')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem('gmr-followed-tags'))).toEqual(['procurement'])
    expect(wrapper.find('[data-testid="tag-follow-procurement"]').text()).toBe('★')
    expect(api.followTag).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('clicking a follow star while authed hits the API, not localStorage', async () => {
    localStorage.setItem('gmr-token', 'fake.jwt')
    const { wrapper } = await mountFeed()
    await wrapper.find('[data-testid="tag-follow-procurement"]').trigger('click')
    await flushPromises()
    expect(api.followTag).toHaveBeenCalledWith('procurement')
    expect(localStorage.getItem('gmr-followed-tags')).toBeNull()
    wrapper.unmount()
  })

  it('cards still show their tag pills inline', async () => {
    const { wrapper } = await mountFeed()
    expect(wrapper.findAll('[data-testid="feed-card-tags"]').length).toBe(2)
    wrapper.unmount()
  })
})
