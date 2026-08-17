import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  listBriefings: vi.fn(),
  getBriefing: vi.fn(),
  watchBriefing: vi.fn(),
  listMyWatches: vi.fn(),
  unwatch: vi.fn(),
}))
vi.mock('../../src/api/session.js', () => ({ isAuthed: { value: true } }))
// The region input has its own tests; a plain field keeps this one about
// briefings rather than about loading the NUTS tree.
vi.mock('../../src/components/NutsRegionInput.vue', () => ({
  default: {
    name: 'NutsRegionInput',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<input data-testid="region" :value="modelValue" '
      + '@input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}))

import BriefingsView from '../../src/views/BriefingsView.vue'
import {
  listBriefings, getBriefing, watchBriefing, listMyWatches, unwatch,
} from '../../src/api/community.js'

const INVEST = {
  id: 'g1', slug: 'public-investment', name: 'Public investment',
  description: 'Where public money goes.', queries: [],
}
const INFLUENCE = {
  id: 'g2', slug: 'corporate-influence', name: 'Corporate influence',
  description: 'Who shapes the rules.', queries: [],
}
const item = (id) => ({
  item_id: id, item_time: '2026-08-13T00:00:00Z', nuts: ['PT17'],
  rank_value: 11000000, title: `Item ${id}`, link: `https://x/${id}`, summary: '',
})

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/briefings', '/my-briefings', '/login'].map(
      (p) => ({ path: p, component: { template: '<div/>' } })),
  })
  await router.push('/briefings')
  await router.isReady()
  const w = mount(BriefingsView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return w
}

async function open(w, slug) {
  await w.find(`[data-testid="briefing-${slug}"]`).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  listBriefings.mockResolvedValue([INVEST, INFLUENCE])
  getBriefing.mockResolvedValue({ ...INVEST, items: [item('a'), item('b')] })
  listMyWatches.mockResolvedValue([])
})

describe('BriefingsView — cards', () => {
  it('lists briefings collapsed, fetching nothing until one is opened', async () => {
    const w = await mountView()
    expect(w.find('[data-testid="briefing-public-investment"]').exists()).toBe(true)
    expect(w.find('[data-testid="panel-public-investment"]').exists()).toBe(false)
    expect(getBriefing).not.toHaveBeenCalled()
  })

  it('expands in place, with the controls inside the card', async () => {
    const w = await mountView()
    await open(w, 'public-investment')
    const panel = w.find('[data-testid="panel-public-investment"]')
    expect(panel.exists()).toBe(true)
    expect(panel.find('[data-testid="region"]').exists()).toBe(true)
    expect(panel.find('[data-testid="volume-public-investment"]').exists()).toBe(true)
    expect(panel.find('[data-testid="watch-public-investment"]').exists()).toBe(true)
  })

  it('shows a short sample inside the card, not the whole briefing', async () => {
    getBriefing.mockResolvedValue({
      ...INVEST, items: ['a', 'b', 'c', 'd', 'e', 'f'].map(item),
    })
    const w = await mountView()
    await open(w, 'public-investment')
    expect(w.findAll('[data-testid="items-public-investment"] li')).toHaveLength(4)
  })

  it('only one card is open at a time', async () => {
    const w = await mountView()
    await open(w, 'public-investment')
    await open(w, 'corporate-influence')
    expect(w.find('[data-testid="panel-public-investment"]').exists()).toBe(false)
    expect(w.find('[data-testid="panel-corporate-influence"]').exists()).toBe(true)
  })

  it('clicking the open card closes it', async () => {
    const w = await mountView()
    await open(w, 'public-investment')
    await open(w, 'public-investment')
    expect(w.find('[data-testid="panel-public-investment"]').exists()).toBe(false)
  })

  it('re-samples when the region or the volume changes', async () => {
    const w = await mountView()
    await open(w, 'public-investment')
    getBriefing.mockClear()
    await w.find('[data-testid="region"]').setValue('PT16')
    await flushPromises()
    expect(getBriefing.mock.calls.at(-1)[1].nuts).toEqual(['PT16'])

    await w.find('[data-testid="volume-public-investment"]').setValue('25')
    await flushPromises()
    expect(getBriefing.mock.calls.at(-1)[1].volume).toBe(25)
  })

  it('watches with the settings shown in that card', async () => {
    const w = await mountView()
    await open(w, 'public-investment')
    await w.find('[data-testid="region"]').setValue('PT')
    await flushPromises()
    watchBriefing.mockResolvedValue({ id: 'w1', group_id: 'g1' })
    listMyWatches.mockResolvedValue([
      { id: 'w1', group_id: 'g1', nuts: ['PT'], volume_per_week: 10, feed_url: 'https://f/1.atom' },
    ])
    await w.find('[data-testid="watch-public-investment"]').trigger('click')
    await flushPromises()
    expect(watchBriefing).toHaveBeenCalledWith('public-investment',
      { nuts: ['PT'], volume_per_week: 10 })
  })

  it('opens a watched briefing with that watch’s own settings', async () => {
    /** Otherwise the sample answers a question the reader did not ask. */
    listMyWatches.mockResolvedValue([
      { id: 'w1', group_id: 'g1', nuts: ['ES30'], volume_per_week: 25, feed_url: 'https://f/1.atom' },
    ])
    const w = await mountView()
    await open(w, 'public-investment')
    expect(getBriefing.mock.calls.at(-1)[1]).toEqual({ nuts: ['ES30'], volume: 25 })
  })

  it('marks which briefings are watched without opening them', async () => {
    listMyWatches.mockResolvedValue([
      { id: 'w1', group_id: 'g1', nuts: ['EU'], volume_per_week: 10, feed_url: 'https://f/1.atom' },
    ])
    const w = await mountView()
    expect(w.find('[data-testid="watching-public-investment"]').exists()).toBe(true)
    expect(w.find('[data-testid="watching-corporate-influence"]').exists()).toBe(false)
  })

  it('sends an anonymous visitor to sign in rather than hiding the option', async () => {
    const session = await import('../../src/api/session.js')
    session.isAuthed.value = false
    const w = await mountView()
    await open(w, 'public-investment')
    expect(w.find('[data-testid="watch-login-public-investment"]').exists()).toBe(true)
    expect(w.find('[data-testid="watch-public-investment"]').exists()).toBe(false)
    session.isAuthed.value = true
  })
})

describe('BriefingsView — managing what you watch', () => {
  beforeEach(() => {
    listMyWatches.mockResolvedValue([
      { id: 'w1', group_id: 'g1', nuts: ['PT'], volume_per_week: 10,
        feed_url: 'https://fontem.eu/capi/feeds/tok.atom' },
    ])
  })

  it('lists the watched briefings with their settings and feed', async () => {
    const w = await mountView()
    const manage = w.find('[data-testid="manage"]')
    expect(manage.exists()).toBe(true)
    expect(manage.text()).toContain('Public investment')
    expect(manage.text()).toContain('PT')
    expect(w.find('[data-testid="copy-public-investment"]').exists()).toBe(true)
  })

  it('is absent entirely when nothing is watched', async () => {
    listMyWatches.mockResolvedValue([])
    const w = await mountView()
    expect(w.find('[data-testid="manage"]').exists()).toBe(false)
  })

  it('copies the Atom URL', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const w = await mountView()
    await w.find('[data-testid="copy-public-investment"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('https://fontem.eu/capi/feeds/tok.atom')
    vi.unstubAllGlobals()
  })

  it('stops watching from inside the card', async () => {
    unwatch.mockResolvedValue(null)
    const w = await mountView()
    await open(w, 'public-investment')
    listMyWatches.mockResolvedValue([])
    await w.find('[data-testid="unwatch-public-investment"]').trigger('click')
    await flushPromises()
    expect(unwatch).toHaveBeenCalledWith('w1')
    expect(w.find('[data-testid="manage"]').exists()).toBe(false)
  })

  it('shows the server error instead of failing silently', async () => {
    listBriefings.mockRejectedValue(new Error('HTTP 503: upstream down'))
    const w = await mountView()
    expect(w.find('[data-testid="error"]').text()).toContain('upstream down')
  })
})
