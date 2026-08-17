import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  listBriefings: vi.fn(),
  getBriefing: vi.fn(),
  addWatch: vi.fn(),
  adjustWatch: vi.fn(),
  listMyWatches: vi.fn(),
  unwatch: vi.fn(),
}))
vi.mock('../../src/api/session.js', () => ({ isAuthed: { value: true } }))
vi.mock('../../src/components/NutsRegionInput.vue', () => ({
  default: {
    name: 'NutsRegionInput',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<input class="region" :value="modelValue" '
      + '@input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}))

import BriefingsView from '../../src/views/BriefingsView.vue'
import {
  listBriefings, getBriefing, addWatch, adjustWatch, listMyWatches, unwatch,
} from '../../src/api/community.js'

const INVEST = { id: 'g1', slug: 'public-investment', name: 'Public investment',
  description: 'Where public money goes.', queries: [] }
const INFLUENCE = { id: 'g2', slug: 'corporate-influence', name: 'Corporate influence',
  description: 'Who shapes the rules.', queries: [] }

const watch = (id, nuts, volume) => ({
  id, group_id: 'g1', nuts, volume_per_week: volume,
  feed_url: `https://fontem.eu/capi/feeds/${id}.atom`,
})
const item = (id) => ({ item_id: id, item_time: '2026-08-13T00:00:00Z', nuts: ['PT17'],
  rank_value: 1000, title: `Item ${id}`, link: `https://x/${id}`, summary: '' })

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

const open = async (w, slug) => {
  await w.find(`[data-testid="briefing-${slug}"]`).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  listBriefings.mockResolvedValue([INVEST, INFLUENCE])
  getBriefing.mockResolvedValue({ ...INVEST, items: [item('a'), item('b')] })
  listMyWatches.mockResolvedValue([])
})

describe('BriefingsView — several watches on one briefing', () => {
  it('lists each subscription separately, with its own settings and feed', async () => {
    listMyWatches.mockResolvedValue([
      watch('w1', ['PT16'], 50), watch('w2', ['PT'], 10), watch('w3', ['EU'], 10),
    ])
    const w = await mountView()
    const subs = w.find('[data-testid="subscriptions"]')
    expect(subs.findAll('.bf-sub-row')).toHaveLength(3)
    expect(subs.text()).toContain('PT16')
    expect(subs.text()).toContain('50 a week')
    // Three subscriptions means three feed URLs to copy.
    for (const id of ['w1', 'w2', 'w3']) {
      expect(w.find(`[data-testid="copy-${id}"]`).exists()).toBe(true)
    }
  })

  it('counts how many watches a briefing has, rather than a yes/no', async () => {
    listMyWatches.mockResolvedValue([watch('w1', ['PT16'], 50), watch('w2', ['PT'], 10)])
    const w = await mountView()
    expect(w.find('[data-testid="watching-public-investment"]').text()).toContain('2')
    expect(w.find('[data-testid="watching-corporate-influence"]').exists()).toBe(false)
  })

  it('adds another watch to a briefing already watched', async () => {
    listMyWatches.mockResolvedValue([watch('w1', ['PT16'], 50)])
    const w = await mountView()
    await open(w, 'public-investment')
    // The button says "add another", not "update".
    expect(w.find('[data-testid="add-public-investment"]').text()).toContain('Add another')

    await w.find('[data-testid="panel-public-investment"] .region').setValue('PT')
    await flushPromises()
    addWatch.mockResolvedValue(watch('w2', ['PT'], 10))
    listMyWatches.mockResolvedValue([watch('w1', ['PT16'], 50), watch('w2', ['PT'], 10)])
    await w.find('[data-testid="add-public-investment"]').trigger('click')
    await flushPromises()

    expect(addWatch).toHaveBeenCalledWith('public-investment',
      { nuts: ['PT'], volume_per_week: 10 })
    expect(w.find('[data-testid="subscriptions"]').findAll('.bf-sub-row')).toHaveLength(2)
  })

  it('edits one subscription by id, leaving the others alone', async () => {
    listMyWatches.mockResolvedValue([watch('w1', ['PT16'], 50), watch('w2', ['PT'], 10)])
    const w = await mountView()
    await w.find('[data-testid="edit-w2"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="editor-w2"]').exists()).toBe(true)
    expect(w.find('[data-testid="editor-w1"]').exists()).toBe(false)

    await w.find('[data-testid="edit-volume-w2"]').setValue('25')
    adjustWatch.mockResolvedValue(watch('w2', ['PT'], 25))
    await w.find('[data-testid="save-w2"]').trigger('click')
    await flushPromises()
    expect(adjustWatch).toHaveBeenCalledWith('w2', { nuts: ['PT'], volume_per_week: 25 })
  })

  it('opens an editor pre-filled with that watch’s own settings', async () => {
    listMyWatches.mockResolvedValue([watch('w1', ['PT16'], 50)])
    const w = await mountView()
    await w.find('[data-testid="edit-w1"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="editor-w1"] .region').element.value).toBe('PT16')
    expect(w.find('[data-testid="edit-volume-w1"]').element.value).toBe('50')
  })

  it('removes one subscription without touching the rest', async () => {
    listMyWatches.mockResolvedValue([watch('w1', ['PT16'], 50), watch('w2', ['PT'], 10)])
    const w = await mountView()
    unwatch.mockResolvedValue(null)
    listMyWatches.mockResolvedValue([watch('w2', ['PT'], 10)])
    await w.find('[data-testid="remove-w1"]').trigger('click')
    await flushPromises()
    expect(unwatch).toHaveBeenCalledWith('w1')
    expect(w.find('[data-testid="subscriptions"]').findAll('.bf-sub-row')).toHaveLength(1)
  })

  it('says so when you watch nothing yet', async () => {
    const w = await mountView()
    expect(w.find('[data-testid="no-subs"]').exists()).toBe(true)
  })
})

describe('BriefingsView — the catalogue', () => {
  it('fetches nothing until a card is opened', async () => {
    const w = await mountView()
    expect(w.find('[data-testid="panel-public-investment"]').exists()).toBe(false)
    expect(getBriefing).not.toHaveBeenCalled()
  })

  it('expands in place with controls and a short sample', async () => {
    getBriefing.mockResolvedValue({ ...INVEST, items: ['a', 'b', 'c', 'd', 'e'].map(item) })
    const w = await mountView()
    await open(w, 'public-investment')
    const panel = w.find('[data-testid="panel-public-investment"]')
    expect(panel.find('.region').exists()).toBe(true)
    expect(panel.find('[data-testid="volume-public-investment"]').exists()).toBe(true)
    expect(w.findAll('[data-testid="items-public-investment"] li')).toHaveLength(4)
  })

  it('re-samples when the settings change', async () => {
    const w = await mountView()
    await open(w, 'public-investment')
    getBriefing.mockClear()
    await w.find('[data-testid="panel-public-investment"] .region').setValue('PT16')
    await flushPromises()
    expect(getBriefing.mock.calls.at(-1)[1].nuts).toEqual(['PT16'])
  })

  it('only one card is open at a time', async () => {
    const w = await mountView()
    await open(w, 'public-investment')
    await open(w, 'corporate-influence')
    expect(w.find('[data-testid="panel-public-investment"]').exists()).toBe(false)
    expect(w.find('[data-testid="panel-corporate-influence"]').exists()).toBe(true)
  })

  it('sends an anonymous visitor to sign in', async () => {
    const session = await import('../../src/api/session.js')
    session.isAuthed.value = false
    const w = await mountView()
    await open(w, 'public-investment')
    expect(w.find('[data-testid="watch-login-public-investment"]').exists()).toBe(true)
    expect(w.find('[data-testid="subscriptions"]').exists()).toBe(false)
    session.isAuthed.value = true
  })

  it('shows the server error instead of failing silently', async () => {
    listBriefings.mockRejectedValue(new Error('HTTP 503: upstream down'))
    const w = await mountView()
    expect(w.find('[data-testid="error"]').text()).toContain('upstream down')
  })
})
