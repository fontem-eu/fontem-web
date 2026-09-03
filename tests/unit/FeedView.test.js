/**
 * FeedView — tag chip strip + URL-driven filter + follow toggle.
 */
import { _internal } from '../../src/api/session.js'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  listReports: vi.fn(),
  listAllTags: vi.fn(),
  listFollowedTags: vi.fn(() => Promise.resolve({ tags: [] })),
  followTag: vi.fn((t) => Promise.resolve({ tag: t })),
  unfollowTag: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('../../src/composables/useBriefingStream.js', () => ({
  loadBriefingStream: vi.fn(),
}))

import * as api from '../../src/api/community.js'
import * as briefings from '../../src/composables/useBriefingStream.js'
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

const BRIEFING_ITEMS = [
  { item_id: 'i1', _from: 'Public investment', title: 'A tender', item_time: '2026-04-03' },
]

beforeEach(() => {
  _internal.clearForTests(); localStorage.clear()
  _resetFollowedTagsForTests()
  vi.clearAllMocks()
  api.listReports.mockResolvedValue(STORIES_ALL)
  api.listAllTags.mockResolvedValue({ tags: TAGS })
  briefings.loadBriefingStream.mockResolvedValue(BRIEFING_ITEMS)
})

afterEach(() => vi.restoreAllMocks())

async function mountFeed(initialPath = '/feed', meta = undefined) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/feed', component: FeedView, ...(meta ? { meta } : {}) },
      { path: '/stories/:id', component: { template: '<div />' } },
    ],
  })
  await router.push(initialPath)
  await router.isReady()
  const wrapper = mount(FeedView, {
    global: { plugins: [router, makeTestI18n()] },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, router }
}

describe('FeedView — what each route shows', () => {
  // The Stories nav entry pointed at the mixed landing feed, so there
  // was nowhere to read only the stories. One component backs both
  // routes; `meta.mixed` is the whole difference.
  it('the landing feed mixes briefings in with the articles', async () => {
    const { wrapper } = await mountFeed('/feed', { mixed: true })
    expect(wrapper.find('[data-testid="feed-briefings"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('A tender')
  })

  it('the stories page shows articles only', async () => {
    const { wrapper } = await mountFeed('/feed', { mixed: false })
    expect(wrapper.find('[data-testid="feed-briefings"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('A tender')
    // Articles are still there — this is a filter on the briefings, not
    // a broken page.
    expect(wrapper.text()).toContain('A')
  })

  it('the stories page does not even request the briefings', async () => {
    // Hiding them client-side would still cost the reader the round
    // trips, and on the signed-out path that is several.
    await mountFeed('/feed', { mixed: false })
    expect(briefings.loadBriefingStream).not.toHaveBeenCalled()
  })

  it('a tag filter hides briefings even on the mixed feed', async () => {
    // Briefing items carry no story tags, so showing them beside a
    // filtered article list would imply they matched the filter.
    const { wrapper } = await mountFeed('/feed?tag=procurement', { mixed: true })
    expect(wrapper.find('[data-testid="feed-briefings"]').exists()).toBe(false)
  })
})

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
    _internal.setAccessToken('fake.jwt')
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

  // ── Tag-filter persistence (batch-5 item 1) ────────────────
  it('persists the active tag to localStorage when a chip is clicked', async () => {
    const { wrapper } = await mountFeed()
    await wrapper.find('[data-testid="tag-chip-procurement"]').trigger('click')
    await flushPromises()
    expect(localStorage.getItem('gmr-stories-tag')).toBe('procurement')
    wrapper.unmount()
  })

  it('drops the persisted tag when the All chip is clicked', async () => {
    localStorage.setItem('gmr-stories-tag', 'procurement')
    const { wrapper } = await mountFeed('/feed?tag=procurement')
    await wrapper.find('[data-testid="tag-chip-all"]').trigger('click')
    await flushPromises()
    expect(localStorage.getItem('gmr-stories-tag')).toBeNull()
    wrapper.unmount()
  })

  it('restores a persisted tag when remounted without a ?tag= query', async () => {
    // The user filtered by `procurement`, then clicked a story card
    // (FeedView unmounted), then came back to `/` — no query in URL.
    localStorage.setItem('gmr-stories-tag', 'procurement')
    api.listReports.mockResolvedValueOnce(STORIES_PROC)

    const { wrapper, router } = await mountFeed('/feed')

    // The router rewrote the URL to carry the saved tag…
    expect(router.currentRoute.value.query.tag).toBe('procurement')
    // …and the listReports call carried tag=procurement, not undefined.
    const lastCall = api.listReports.mock.calls[api.listReports.mock.calls.length - 1][0]
    expect(lastCall).toMatchObject({ tag: 'procurement' })
    // The active-filter banner is visible.
    expect(wrapper.find('[data-testid="feed-active-filter"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('an explicit ?tag= in the URL wins over a stale localStorage value', async () => {
    localStorage.setItem('gmr-stories-tag', 'lobbying')
    api.listReports.mockResolvedValueOnce(STORIES_PROC)
    const { wrapper, router } = await mountFeed('/feed?tag=procurement')
    expect(router.currentRoute.value.query.tag).toBe('procurement')
    const lastCall = api.listReports.mock.calls[api.listReports.mock.calls.length - 1][0]
    expect(lastCall).toMatchObject({ tag: 'procurement' })
    wrapper.unmount()
  })
})
