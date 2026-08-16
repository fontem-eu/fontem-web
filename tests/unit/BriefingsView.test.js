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
// The picker fetches the NUTS tree from the API; a plain input keeps this
// test about briefings rather than about region loading.
vi.mock('../../src/components/NutsRegionPicker.vue', () => ({
  default: {
    name: 'NutsRegionPicker',
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

const GROUP = {
  id: 'g1', slug: 'public-investment', name: 'Public investment',
  description: 'Where public money goes.', queries: [],
}
const ITEM = {
  item_id: 'c1', item_time: '2026-08-13T00:00:00Z', nuts: ['PT17'],
  rank_value: 11000000, title: 'A big contract', link: 'https://fontem.eu/c/1',
  summary: 'Details',
}

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

beforeEach(() => {
  vi.clearAllMocks()
  listBriefings.mockResolvedValue([GROUP])
  getBriefing.mockResolvedValue({ ...GROUP, items: [ITEM] })
  listMyWatches.mockResolvedValue([])
})

describe('BriefingsView', () => {
  it('lists briefings and previews the first without being asked', async () => {
    const w = await mountView()
    expect(w.find('[data-testid="briefing-public-investment"]').text())
      .toContain('Public investment')
    expect(w.find('[data-testid="items"]').text()).toContain('A big contract')
  })

  it('previews anonymously — deciding to watch means seeing inside first', async () => {
    // The preview call carries no auth of its own; the endpoint is public.
    await mountView()
    expect(getBriefing).toHaveBeenCalled()
    expect(watchBriefing).not.toHaveBeenCalled()
  })

  it('re-previews when the region changes, so the sample matches the settings', async () => {
    const w = await mountView()
    getBriefing.mockClear()
    await w.find('[data-testid="region"]').setValue('PT16')
    await flushPromises()
    expect(getBriefing.mock.calls.at(-1)[1].nuts).toEqual(['PT16'])
  })

  it('sends EU when no region is chosen', async () => {
    await mountView()
    expect(getBriefing.mock.calls.at(-1)[1].nuts).toEqual(['EU'])
  })

  it('re-previews when the volume changes', async () => {
    const w = await mountView()
    getBriefing.mockClear()
    await w.find('[data-testid="volume"]').setValue('25')
    await flushPromises()
    expect(getBriefing.mock.calls.at(-1)[1].volume).toBe(25)
  })

  it('watches with the settings currently shown', async () => {
    const w = await mountView()
    await w.find('[data-testid="region"]').setValue('PT')
    await w.find('[data-testid="volume"]').setValue('3')
    await flushPromises()
    watchBriefing.mockResolvedValue({ id: 'w1', group_id: 'g1' })
    listMyWatches.mockResolvedValue([{ id: 'w1', group_id: 'g1', nuts: ['PT'] }])

    await w.find('[data-testid="watch"]').trigger('click')
    await flushPromises()
    expect(watchBriefing).toHaveBeenCalledWith('public-investment',
      { nuts: ['PT'], volume_per_week: 3 })
  })

  it('offers update and stop once already watching', async () => {
    listMyWatches.mockResolvedValue([{ id: 'w1', group_id: 'g1', nuts: ['EU'] }])
    const w = await mountView()
    expect(w.find('[data-testid="watch"]').exists()).toBe(false)
    expect(w.find('[data-testid="update-watch"]').exists()).toBe(true)
    expect(w.find('[data-testid="watching-note"]').exists()).toBe(true)

    unwatch.mockResolvedValue(null)
    listMyWatches.mockResolvedValue([])
    await w.find('[data-testid="unwatch"]').trigger('click')
    await flushPromises()
    expect(unwatch).toHaveBeenCalledWith('w1')
    expect(w.find('[data-testid="watch"]').exists()).toBe(true)
  })

  it('sends an anonymous visitor to sign in rather than hiding the button', async () => {
    const session = await import('../../src/api/session.js')
    session.isAuthed.value = false
    const w = await mountView()
    expect(w.find('[data-testid="watch-login"]').exists()).toBe(true)
    expect(w.find('[data-testid="watch"]').exists()).toBe(false)
    session.isAuthed.value = true
  })

  it('says so when a briefing has nothing for these settings', async () => {
    getBriefing.mockResolvedValue({ ...GROUP, items: [] })
    const w = await mountView()
    expect(w.find('[data-testid="no-items"]').exists()).toBe(true)
  })

  it('shows the server error instead of failing silently', async () => {
    listBriefings.mockRejectedValue(new Error('HTTP 503: upstream down'))
    const w = await mountView()
    expect(w.find('[data-testid="error"]').text()).toContain('upstream down')
  })
})
