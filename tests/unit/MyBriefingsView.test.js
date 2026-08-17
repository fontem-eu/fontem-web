import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  listMyWatches: vi.fn(),
  listBriefings: vi.fn(),
  getBriefing: vi.fn(),
}))

import MyBriefingsView from '../../src/views/MyBriefingsView.vue'
import { listMyWatches, listBriefings, getBriefing } from '../../src/api/community.js'

const SEEN_KEY = 'fontem-briefings-last-visit'
const GROUP = { id: 'g1', slug: 'public-investment', name: 'Public investment', queries: [] }
const WATCH = {
  id: 'w1', group_id: 'g1', nuts: ['PT'], volume_per_week: 10,
  feed_url: 'https://fontem.eu/capi/feeds/tok123.atom',
}

function item(id, when, firstSeen) {
  return {
    item_id: id, item_time: when, first_seen_at: firstSeen || when,
    nuts: ['PT17'], rank_value: 5000000, title: `Item ${id}`,
    link: `https://fontem.eu/c/${id}`, summary: '',
  }
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/my-briefings', '/briefings'].map(
      (p) => ({ path: p, component: { template: '<div/>' } })),
  })
  await router.push('/my-briefings')
  await router.isReady()
  const w = mount(MyBriefingsView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  listMyWatches.mockResolvedValue([WATCH])
  listBriefings.mockResolvedValue([GROUP])
  getBriefing.mockResolvedValue({ ...GROUP, items: [item('a', '2026-08-13T00:00:00Z')] })
})
afterEach(() => localStorage.clear())

describe('MyBriefingsView', () => {
  it('asks each briefing for that watch’s own regions and volume', async () => {
    await mountView()
    expect(getBriefing).toHaveBeenCalledWith('public-investment',
      { nuts: ['PT'], volume: 10 })
  })

  it('is a reading surface only — managing lives on /briefings', async () => {
    const w = await mountView()
    expect(w.find('[data-testid="feeds"]').exists()).toBe(false)
    expect(w.find('[data-testid="copy-w1"]').exists()).toBe(false)
    expect(w.find('[data-testid="manage-link"]').exists()).toBe(true)
  })

  it('tags each item with the briefing it came from', async () => {
    const w = await mountView()
    const tags = w.findAll('[data-testid="source-tag"]').map((t) => t.text())
    expect(tags).toEqual(['Public investment'])
  })

  it('marks what arrived since the last visit', async () => {
    localStorage.setItem(SEEN_KEY, '2026-08-12T00:00:00Z')
    getBriefing.mockResolvedValue({
      ...GROUP,
      items: [
        item('fresh', '2026-08-13T00:00:00Z', '2026-08-13T06:00:00Z'),
        item('old', '2026-08-10T00:00:00Z', '2026-08-10T06:00:00Z'),
      ],
    })
    const w = await mountView()
    expect(w.findAll('[data-testid="new-badge"]')).toHaveLength(1)
    expect(w.find('[data-testid="new-count"]').text()).toContain('1')
  })

  it('marks nothing as new on a first ever visit', async () => {
    const w = await mountView()
    expect(w.findAll('[data-testid="new-badge"]')).toHaveLength(0)
  })

  it('records the visit so the next one can diff against it', async () => {
    await mountView()
    expect(localStorage.getItem(SEEN_KEY)).toBeTruthy()
  })

  it('merges several briefings newest-first', async () => {
    listMyWatches.mockResolvedValue([WATCH, { ...WATCH, id: 'w2', group_id: 'g2' }])
    listBriefings.mockResolvedValue([GROUP, { ...GROUP, id: 'g2', slug: 'law', name: 'Law' }])
    getBriefing.mockImplementation(async (slug) => ({
      ...GROUP,
      items: slug === 'law'
        ? [item('newest', '2026-08-14T00:00:00Z')]
        : [item('older', '2026-08-11T00:00:00Z')],
    }))
    const w = await mountView()
    const titles = w.findAll('[data-testid="items"] a').map((a) => a.text())
    expect(titles).toEqual(['Item newest', 'Item older'])
    // Merged from two briefings, and each item still says which.
    expect(w.findAll('[data-testid="source-tag"]').map((t) => t.text()))
      .toEqual(['Law', 'Public investment'])
  })

  it('points a reader with no watches at the catalogue', async () => {
    listMyWatches.mockResolvedValue([])
    const w = await mountView()
    expect(w.find('[data-testid="nothing-watched"]').exists()).toBe(true)
  })

  it('says so when nothing is in the watched briefings', async () => {
    getBriefing.mockResolvedValue({ ...GROUP, items: [] })
    const w = await mountView()
    expect(w.find('[data-testid="no-items"]').exists()).toBe(true)
  })

  it('shows the server error instead of failing silently', async () => {
    listMyWatches.mockRejectedValue(new Error('HTTP 500: boom'))
    const w = await mountView()
    expect(w.find('[data-testid="error"]').text()).toContain('boom')
  })
})
