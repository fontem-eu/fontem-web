/**
 * FeedView — tag chip strip + URL-driven filter + follow toggle.
 */
import { _internal } from '../../src/api/session.js'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, KeepAlive } from 'vue'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { CACHED_VIEWS } from '../../src/router/cachedViews.js'
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

// Real names for a real chain, so the card test asserts on what the
// catalogue actually returns for CZ010 rather than on invented strings.
vi.mock('../../src/api/geo.js', () => ({
  fetchClientRegion: vi.fn(() => Promise.resolve({ nuts0: null })),
}))
vi.mock('../../src/api/nuts.js', () => ({
  fetchNutsRegions: vi.fn(() => Promise.resolve({
    regions: [
      { code: 'CZ010', name: 'Hlavní město Praha', level: 3 },
      { code: 'CZ01', name: 'Praha', level: 2 },
      { code: 'CZ0', name: 'Česko', level: 1 },
    ],
  })),
}))

import * as api from '../../src/api/community.js'
import * as briefings from '../../src/composables/useBriefingStream.js'
import { _resetNutsLabelsForTests } from '../../src/composables/useNutsLabels.js'
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
  {
    item_id: 'i1', _from: 'Public investment', _group: 'public-investment', title: 'A tender',
    item_time: '2026-04-03',
    // The origin the stored query bakes in, pre-rename — what prod
    // actually serves today.
    link: 'https://fontem.eu/contract/c818c705-1752-4cb9-854c-c8d5b00f5f81',
    // What it was, and where. Both come straight off the item: the
    // query puts the contract's own title in `summary`.
    summary: 'D0 stavba 511, Běchovice - D1',
    nuts: ['CZ010'],
  },
  {
    item_id: 'i2', _from: 'Corporate influence', _group: 'corporate-influence', title: 'A lobby update',
    item_time: '2026-04-02',
    // The coalesce-to-empty case: a lobbyist with no resolved company.
    link: 'https://fontem.eu/company/',
  },
]

beforeEach(() => {
  _internal.clearForTests(); localStorage.clear()
  _resetFollowedTagsForTests()
  vi.clearAllMocks()
  api.listReports.mockResolvedValue(STORIES_ALL)
  api.listAllTags.mockResolvedValue({ tags: TAGS })
  briefings.loadBriefingStream.mockResolvedValue(BRIEFING_ITEMS)
  _resetNutsLabelsForTests()
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

const kinds = (wrapper) => wrapper.findAll('li[data-kind]').map((li) => li.attributes('data-kind')[0]).join('')

describe('FeedView — one feed, three views of it', () => {
  // Feed, Stories and Briefings were three menu entries over one stream.
  // They are one feed now, and which part of it to show is in the URL.
  it('by default mixes briefings in with the stories', async () => {
    const { wrapper } = await mountFeed('/feed')
    expect(kinds(wrapper)).toContain('b')
    expect(kinds(wrapper)).toContain('s')
    expect(wrapper.text()).toContain('A tender')
  })

  it('each view describes itself accurately', async () => {
    // One sentence cannot be true of every view. An e2e also reads
    // .feed-sub to prove a locale switch re-renders template strings,
    // so it has to exist on each.
    const all = await mountFeed('/feed')
    const stories = await mountFeed('/feed?show=stories')
    const briefingsOnly = await mountFeed('/feed?show=briefings')
    const subs = [all, stories, briefingsOnly].map((m) => m.wrapper.find('.feed-sub').text())
    expect(new Set(subs).size).toBe(3)
  })

  it('?show=stories shows stories only', async () => {
    const { wrapper } = await mountFeed('/feed?show=stories')
    expect(kinds(wrapper)).toBe('ss')
    expect(wrapper.text()).not.toContain('A tender')
  })

  it('?show=stories does not even request the briefings', async () => {
    // Hiding them client-side would still cost the reader the round
    // trips, and on the signed-out path that is several.
    await mountFeed('/feed?show=stories')
    expect(briefings.loadBriefingStream).not.toHaveBeenCalled()
  })

  it('?show=briefings shows briefings only, and does not ask for stories', async () => {
    const { wrapper } = await mountFeed('/feed?show=briefings')
    expect(kinds(wrapper)).toBe('bb')
    expect(api.listReports).not.toHaveBeenCalled()
  })

  it('?briefing=<slug> narrows the feed to that one briefing', async () => {
    const { wrapper } = await mountFeed('/feed?briefing=corporate-influence')
    expect(kinds(wrapper)).toBe('b')
    expect(wrapper.text()).toContain('A lobby update')
    expect(wrapper.text()).not.toContain('A tender')
  })

  it('a tag filter hides briefings on the mixed feed', async () => {
    // Briefing items carry no story tags, so showing them beside a
    // filtered story list would imply they matched the filter.
    api.listReports.mockResolvedValue(STORIES_PROC)
    const { wrapper } = await mountFeed('/feed?tag=procurement')
    expect(kinds(wrapper)).toBe('s')
  })

  it('a tag does not empty the briefings-only view the reader chose', async () => {
    const { wrapper } = await mountFeed('/feed?show=briefings&tag=procurement')
    expect(kinds(wrapper)).toBe('bb')
    // Tags are a story filter; with no stories on screen the strip goes.
    expect(wrapper.find('[data-testid="feed-tag-strip"]').exists()).toBe(false)
  })
})

describe('FeedView — the filter control', () => {
  it('writes the choice to the URL', async () => {
    const { wrapper, router } = await mountFeed('/feed')
    await wrapper.find('[data-testid="feed-filter-stories"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.show).toBe('stories')
    expect(kinds(wrapper)).toBe('ss')
    await wrapper.find('[data-testid="feed-filter-all"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.show).toBeUndefined()
    expect(kinds(wrapper)).toContain('b')
  })

  it('offers the briefings actually in the stream, and picking one narrows to it', async () => {
    const { wrapper, router } = await mountFeed('/feed')
    const select = wrapper.find('[data-testid="feed-briefing-select"]')
    const values = select.findAll('option').map((o) => o.attributes('value'))
    expect(values).toEqual(['', 'public-investment', 'corporate-influence'])
    await select.setValue('public-investment')
    await flushPromises()
    expect(router.currentRoute.value.query.briefing).toBe('public-investment')
    expect(kinds(wrapper)).toBe('b')
    expect(wrapper.text()).toContain('A tender')
  })

  it('marks the active view for assistive technology', async () => {
    const { wrapper } = await mountFeed('/feed?show=stories')
    expect(wrapper.find('[data-testid="feed-filter-stories"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="feed-filter-all"]').attributes('aria-pressed')).toBe('false')
  })
})

describe('FeedView — the feed remembers its view', () => {
  // Links back to the feed carry no query, so without this a reader who
  // opened a story from "Stories only" came back to everything.
  it('restores the last view when arriving without one', async () => {
    localStorage.setItem('gmr-feed-view', 'stories')
    const { router } = await mountFeed('/feed')
    expect(router.currentRoute.value.query.show).toBe('stories')
    // Adopted at mount, so the first request is already the right one.
    expect(briefings.loadBriefingStream).not.toHaveBeenCalled()
  })

  it('restores one chosen briefing', async () => {
    localStorage.setItem('gmr-feed-view', 'briefing:corporate-influence')
    const { wrapper, router } = await mountFeed('/feed')
    expect(router.currentRoute.value.query.briefing).toBe('corporate-influence')
    expect(kinds(wrapper)).toBe('b')
  })

  it('an explicit view in the URL wins over the remembered one', async () => {
    localStorage.setItem('gmr-feed-view', 'stories')
    const { router } = await mountFeed('/feed?show=briefings')
    expect(router.currentRoute.value.query.show).toBe('briefings')
  })

  it('choosing "All" forgets the view for good', async () => {
    localStorage.setItem('gmr-feed-view', 'stories')
    const { wrapper, router } = await mountFeed('/feed')
    await wrapper.find('[data-testid="feed-filter-all"]').trigger('click')
    await flushPromises()
    expect(localStorage.getItem('gmr-feed-view')).toBeNull()
    // Not put straight back by the restore that runs on every arrival.
    expect(router.currentRoute.value.query.show).toBeUndefined()
    expect(kinds(wrapper)).toContain('b')
  })
})

describe('FeedView — a briefing card says what and where', () => {
  it('shows the thing itself, not just who and how much', async () => {
    // The headline answers who and how much. The item's summary is the
    // contract's own title — the "what" — and without it a reader has to
    // open the record to learn what was bought.
    const { wrapper } = await mountFeed('/feed', { mixed: true })
    const what = wrapper.find('[data-testid="feed-briefing-what-i1"]')
    expect(what.exists()).toBe(true)
    expect(what.text()).toBe('D0 stavba 511, Běchovice - D1')
  })

  it('names the place as a chain, not a NUTS code', async () => {
    const { wrapper } = await mountFeed('/feed', { mixed: true })
    const where = wrapper.find('[data-testid="feed-briefing-where-i1"]')
    expect(where.exists()).toBe(true)
    expect(where.text()).toBe('Hlavní město Praha › Praha › Česko')
    expect(where.text()).not.toContain('CZ010')
  })

  it('omits the line entirely when an item has neither', async () => {
    // A card with nothing to add should not grow by an empty row.
    const { wrapper } = await mountFeed('/feed', { mixed: true })
    expect(wrapper.find('[data-testid="feed-briefing-detail-i2"]').exists()).toBe(false)
  })
})

describe('FeedView — briefing cards lead somewhere', () => {
  it('links a card to the destination its query gave it', async () => {
    const { wrapper } = await mountFeed('/feed', { mixed: true })
    const a = wrapper.find('[data-testid="feed-briefing-link-i1"]')
    expect(a.exists()).toBe(true)
    // A router path, not the absolute origin baked into the row —
    // otherwise a click on staging lands the reader on production.
    expect(a.attributes('href')).toBe('/contract/c818c705-1752-4cb9-854c-c8d5b00f5f81')
  })

  it('leaves an item with no resolvable destination unlinked', async () => {
    // '/company/' with no id matches no route. A dead click is worse
    // than plain text.
    const { wrapper } = await mountFeed('/feed', { mixed: true })
    expect(wrapper.find('[data-testid="feed-briefing-link-i2"]').exists()).toBe(false)
    // The item itself is still shown — it is news either way.
    expect(wrapper.text()).toContain('A lobby update')
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
    expect(wrapper.findAll('[data-testid="feed-story-tags"]').length).toBe(2)
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

/**
 * The feed is kept alive (src/router/cachedViews.js), so these mount it the
 * way App.vue does rather than on its own. Mounted directly, FeedView is
 * re-created on every visit and none of this can go wrong — which is how a
 * lost tag filter shipped past every test above and was caught only by the
 * promotion gate's FEED-TAG-PERSIST.
 */
describe('FeedView — kept alive, as App.vue mounts it', () => {
  async function mountKeptAlive(initialPath) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/stories-feed', component: FeedView, meta: { mixed: false } },
        { path: '/stories/:id', component: { template: '<div data-testid="story-page" />' } },
      ],
    })
    await router.push(initialPath)
    await router.isReady()
    // Kept alive by name, keyed by path — the same shape as App.vue.
    const Shell = {
      render: () => h(RouterView, null, {
        default: ({ Component, route: r }) => h(KeepAlive, { include: CACHED_VIEWS }, {
          default: () => (Component ? h(Component, { key: r.path }) : null),
        }),
      }),
    }
    const wrapper = mount(Shell, {
      global: { plugins: [router, makeTestI18n()] },
      attachTo: document.body,
    })
    await flushPromises()
    return { wrapper, router }
  }

  const fetches = () => api.listReports.mock.calls.length

  it('keeps a tag filter when the reader opens a story and follows the link back', async () => {
    const { wrapper, router } = await mountKeptAlive('/stories-feed')
    api.listReports.mockResolvedValue(STORIES_PROC)
    await wrapper.find('[data-testid="tag-chip-procurement"]').trigger('click')
    await flushPromises()
    const whileFiltered = fetches()

    await router.push('/stories/a')
    await flushPromises()
    // Hidden, the feed must not react to the story's route at all.
    expect(fetches()).toBe(whileFiltered)

    // "Back to stories" is a link: it arrives with no ?tag= in the URL.
    await router.push('/stories-feed')
    await flushPromises()

    expect(router.currentRoute.value.query.tag).toBe('procurement')
    expect(wrapper.find('[data-testid="feed-active-filter"]').exists()).toBe(true)
    // The cached, filtered list is shown as it was, not refetched.
    expect(fetches()).toBe(whileFiltered)
    wrapper.unmount()
  })

  it('does not refetch behind the reader when they come back through history', async () => {
    localStorage.setItem('gmr-stories-tag', 'procurement')
    const { wrapper, router } = await mountKeptAlive('/stories-feed?tag=procurement')
    const before = fetches()

    await router.push('/stories/a')
    await flushPromises()
    router.back()
    for (let i = 0; i < 20 && router.currentRoute.value.path !== '/stories-feed'; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/stories-feed?tag=procurement')
    expect(fetches()).toBe(before)
    wrapper.unmount()
  })

  it('an "All" click still clears the filter for good', async () => {
    localStorage.setItem('gmr-stories-tag', 'procurement')
    const { wrapper, router } = await mountKeptAlive('/stories-feed?tag=procurement')

    await wrapper.find('[data-testid="tag-chip-all"]').trigger('click')
    await flushPromises()
    await router.push('/stories/a')
    await flushPromises()
    await router.push('/stories-feed')
    await flushPromises()

    expect(router.currentRoute.value.query.tag).toBeUndefined()
    expect(wrapper.find('[data-testid="feed-active-filter"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

// ── The stream: interleaving and paging ────────────────────────────

const manyBriefings = (n) => Array.from({ length: n }, (_, i) => ({
  item_id: `mb${i}`, _from: 'Public investment', _group: 'public-investment',
  item_time: '2026-04-01', summary: `Finding ${i}`, link: 'https://fontem.eu/company/',
}))
const manyStories = (n) => Array.from({ length: n }, (_, i) => ({
  id: `ms${i}`, title: `Story ${i}`, abstract: '', updated_at: '2026-04-01', tags: [],
}))
/** Serve `stories` a page at a time, honouring limit/offset like the API. */
function servePages(stories) {
  api.listReports.mockImplementation(({ limit, offset }) =>
    Promise.resolve(stories.slice(offset, offset + limit)))
}
async function settle(times = 30) {
  for (let i = 0; i < times; i += 1) await flushPromises()
}
const entryIds = (wrapper) => wrapper.findAll('li[data-kind]').map((li) => li.attributes('data-testid'))
const clickMore = async (wrapper) => {
  await wrapper.find('[data-testid="feed-load-more"]').trigger('click')
  await settle()
}

describe('FeedView — stories inside the run of briefings', () => {
  it('puts a story after every five briefings, and the leftovers at the end', async () => {
    briefings.loadBriefingStream.mockResolvedValue(manyBriefings(12))
    api.listReports.mockResolvedValue(manyStories(3))
    const { wrapper } = await mountFeed('/feed')
    expect(kinds(wrapper)).toBe('bbbbbsbbbbbsbbs')
  })

  it('renders a story in the same card as a briefing, in its own reserved colour', async () => {
    briefings.loadBriefingStream.mockResolvedValue(manyBriefings(5))
    api.listReports.mockResolvedValue(manyStories(1))
    const { wrapper } = await mountFeed('/feed')
    const story = wrapper.find('[data-testid="feed-story-ms0"]')
    const briefing = wrapper.find('li[data-kind="briefing"] article')
    expect(story.classes()).toContain('bcard')
    expect(briefing.classes()).toContain('bcard')
    // The kind is in the class, so the colour comes from one place — and
    // in words, for a reader who cannot use the colour.
    expect(story.classes()).toContain('bcard--story')
    expect(story.find('[data-testid="feed-story-kind"]').text()).toContain('Data story')
    expect(story.find('a').attributes('href')).toBe('/stories/ms0')
  })
})

describe('FeedView — paging', () => {
  it('shows twenty at a time, asking the server for each next page of stories', async () => {
    servePages(manyStories(45))
    const { wrapper } = await mountFeed('/feed?show=stories')
    expect(entryIds(wrapper)).toHaveLength(20)
    await clickMore(wrapper)
    expect(entryIds(wrapper)).toHaveLength(40)
    await clickMore(wrapper)
    expect(entryIds(wrapper)).toHaveLength(45)
    expect(api.listReports.mock.calls.map(([q]) => q.offset)).toEqual([0, 20, 40])
    expect(wrapper.find('[data-testid="feed-load-more"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="feed-end"]').exists()).toBe(true)
  })

  it('never moves what is already on screen when the next page of stories arrives', async () => {
    // Many briefings, few stories per page: the case where a later page
    // of stories would otherwise be spliced in between briefings the
    // reader has already scrolled past.
    briefings.loadBriefingStream.mockResolvedValue(manyBriefings(150))
    servePages(manyStories(60))
    const { wrapper } = await mountFeed('/feed')
    for (let i = 0; i < 5; i += 1) await clickMore(wrapper)
    const before = entryIds(wrapper)
    expect(before).toHaveLength(120)
    const storyPagesBefore = api.listReports.mock.calls.length
    await clickMore(wrapper)
    // This page could only be filled by fetching more stories...
    expect(api.listReports.mock.calls.length).toBeGreaterThan(storyPagesBefore)
    // ...and fetching them changed nothing above the fold.
    expect(entryIds(wrapper).slice(0, 120)).toEqual(before)
    expect(entryIds(wrapper)).toHaveLength(140)
  })

  it('drops a page that arrives after the reader changed the filter', async () => {
    // The unfiltered request is still in flight when the reader picks a
    // tag. Both views show stories, so a late answer from the first would
    // land in the second — three unrelated stories under "procurement".
    let answerLate
    api.listReports
      .mockImplementationOnce(() => new Promise((r) => { answerLate = r }))
      .mockResolvedValue(STORIES_PROC)
    const { wrapper } = await mountFeed('/feed?show=stories')
    await wrapper.find('[data-testid="tag-chip-procurement"]').trigger('click')
    await settle()
    answerLate(manyStories(3))
    await settle()
    expect(entryIds(wrapper)).toEqual(['feed-card-a'])
  })
})

describe('FeedView — infinite scroll, with a pause every five pages', () => {
  // A stand-in observer: the feed only needs to be told "look now".
  let observers
  beforeEach(() => {
    observers = []
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb) { this.cb = cb; observers.push(this) }
      observe() {}
      disconnect() {}
    })
    // Keep the sentinel permanently in view: the worst case, where
    // nothing but the pause would ever stop the feed loading.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 101, left: 0, right: 1, width: 1, height: 1, x: 0, y: 100, toJSON() {},
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('loads five pages on its own, then waits for a click', async () => {
    servePages(manyStories(250))
    const { wrapper } = await mountFeed('/feed?show=stories')
    await settle()
    expect(entryIds(wrapper)).toHaveLength(100)
    expect(wrapper.find('[data-testid="feed-load-more"]').exists()).toBe(true)
    expect(wrapper.find('.feed-more-note').text()).toContain('100')
  })

  it('after the click, five more pages, then the next pause', async () => {
    servePages(manyStories(250))
    const { wrapper } = await mountFeed('/feed?show=stories')
    await settle()
    await clickMore(wrapper)
    expect(entryIds(wrapper)).toHaveLength(200)
    expect(wrapper.find('[data-testid="feed-load-more"]').exists()).toBe(true)
  })

  it('stops at the end without offering more', async () => {
    servePages(manyStories(30))
    const { wrapper } = await mountFeed('/feed?show=stories')
    await settle()
    expect(entryIds(wrapper)).toHaveLength(30)
    expect(wrapper.find('[data-testid="feed-load-more"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="feed-end"]').exists()).toBe(true)
  })

  it('loads when the observer reports the bottom coming into view', async () => {
    // Sentinel out of view at first: only the first page.
    Element.prototype.getBoundingClientRect.mockReturnValue({
      top: 99999, bottom: 100000, left: 0, right: 1, width: 1, height: 1, x: 0, y: 99999, toJSON() {},
    })
    servePages(manyStories(100))
    const { wrapper } = await mountFeed('/feed?show=stories')
    await settle()
    expect(entryIds(wrapper)).toHaveLength(20)
    // The reader scrolls down: the bottom is in view and the observer says so.
    Element.prototype.getBoundingClientRect.mockReturnValue({
      top: 100, bottom: 101, left: 0, right: 1, width: 1, height: 1, x: 0, y: 100, toJSON() {},
    })
    observers.at(-1).cb([{ isIntersecting: true }])
    await settle()
    expect(entryIds(wrapper).length).toBeGreaterThan(20)
  })
})
