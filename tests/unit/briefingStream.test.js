/**
 * The briefing stream: what a reader sees, signed in or not.
 *
 * The signed-out half is the interesting one. Someone who has never
 * subscribed to anything should still land on a feed with something in
 * it, and it should be local first — ten a week of public investment
 * from the country we can see them connecting from, three a week from
 * the EU. Those are two watches at different volumes rather than one
 * bigger number, because a local award and a European one are different
 * kinds of news to the same reader.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/api/community.js', () => ({
  listBriefings: vi.fn(),
  getBriefing: vi.fn(),
  listMyWatches: vi.fn(),
}))
vi.mock('../../src/api/geo.js', () => ({ fetchClientRegion: vi.fn() }))

const { listBriefings, getBriefing, listMyWatches } = await import('../../src/api/community.js')
const { fetchClientRegion } = await import('../../src/api/geo.js')
const {
  loadBriefingStream, anonymousWatches, mergeBriefingItems,
  DEFAULT_LOCAL_VOLUME, DEFAULT_EU_VOLUME, DEFAULT_BRIEFING_SLUG,
} = await import('../../src/composables/useBriefingStream.js')

const PI = { id: 'b1', slug: 'public-investment', name: 'Public investment' }
const CI = { id: 'b2', slug: 'corporate-influence', name: 'Corporate influence' }

const item = (id, time) => ({ item_id: id, item_time: time, title: `t-${id}` })

beforeEach(() => {
  listBriefings.mockResolvedValue([PI, CI])
  getBriefing.mockResolvedValue({ items: [] })
  listMyWatches.mockResolvedValue([])
  fetchClientRegion.mockResolvedValue({ nuts0: 'PT', country_alpha3: 'PRT' })
})
afterEach(() => { vi.clearAllMocks() })

describe('anonymousWatches', () => {
  it('asks for the local country first, then the EU, at different volumes', () => {
    const w = anonymousWatches('PT')
    expect(w).toHaveLength(2)
    expect(w[0]).toEqual({ nuts: ['PT'], volume_per_week: DEFAULT_LOCAL_VOLUME })
    expect(w[1]).toEqual({ nuts: [], volume_per_week: DEFAULT_EU_VOLUME })
    expect(DEFAULT_LOCAL_VOLUME).toBe(10)
    expect(DEFAULT_EU_VOLUME).toBe(3)
  })

  it('falls back to the EU alone rather than guessing a region', () => {
    // A datacentre IP, a VPN, or a country the database does not cover.
    // Inventing a region would put someone in a place they are not.
    expect(anonymousWatches(null)).toEqual([{ nuts: [], volume_per_week: DEFAULT_EU_VOLUME }])
  })
})

describe('mergeBriefingItems', () => {
  it('shows an item once when overlapping watches both return it', () => {
    // Coimbra and Portugal both cover Coimbra.
    const a = { ...item('i1', '2026-01-01'), _from: 'Public investment' }
    expect(mergeBriefingItems([[a], [{ ...a }]])).toHaveLength(1)
  })

  it('keeps the same record when it arrives from a DIFFERENT briefing', () => {
    // Two briefings finding the same contract is two findings.
    const a = { ...item('i1', '2026-01-01'), _from: 'Public investment' }
    const b = { ...item('i1', '2026-01-01'), _from: 'Corporate influence' }
    expect(mergeBriefingItems([[a], [b]])).toHaveLength(2)
  })

  it('orders newest first', () => {
    const older = { ...item('i1', '2026-01-01'), _from: 'X' }
    const newer = { ...item('i2', '2026-06-01'), _from: 'X' }
    expect(mergeBriefingItems([[older, newer]])[0].item_id).toBe('i2')
  })
})

describe('loadBriefingStream — signed out', () => {
  it('seeds from public investment at 10 local and 3 EU', async () => {
    await loadBriefingStream(false)
    const calls = getBriefing.mock.calls
    expect(calls).toHaveLength(2)
    expect(calls.every(([slug]) => slug === DEFAULT_BRIEFING_SLUG)).toBe(true)
    expect(calls[0][1]).toEqual({ nuts: ['PT'], volume: 10 })
    expect(calls[1][1]).toEqual({ nuts: [], volume: 3 })
  })

  it('never asks for the reader\'s watches', async () => {
    await loadBriefingStream(false)
    expect(listMyWatches).not.toHaveBeenCalled()
  })

  it('still returns the EU stream when the region cannot be detected', async () => {
    fetchClientRegion.mockResolvedValue({ nuts0: null })
    getBriefing.mockResolvedValue({ items: [item('i1', '2026-01-01')] })
    const out = await loadBriefingStream(false)
    expect(getBriefing.mock.calls).toHaveLength(1)
    expect(getBriefing.mock.calls[0][1]).toEqual({ nuts: [], volume: 3 })
    expect(out).toHaveLength(1)
  })

  it('treats a failed region lookup as no region, not an error', async () => {
    fetchClientRegion.mockRejectedValue(new Error('geoip down'))
    await expect(loadBriefingStream(false)).resolves.toEqual([])
    expect(getBriefing.mock.calls[0][1]).toEqual({ nuts: [], volume: 3 })
  })

  it('tags every item with the briefing it came from', async () => {
    getBriefing.mockResolvedValue({ items: [item('i1', '2026-01-01')] })
    const out = await loadBriefingStream(false)
    expect(out.every((i) => i._from === 'Public investment')).toBe(true)
  })
})

describe('loadBriefingStream — signed in', () => {
  it('reads the watches the reader configured, at their own volumes', async () => {
    listMyWatches.mockResolvedValue([
      { group_id: 'b1', nuts: ['PT16'], volume_per_week: 50 },
      { group_id: 'b2', nuts: ['ES'], volume_per_week: 5 },
    ])
    await loadBriefingStream(true)
    expect(fetchClientRegion).not.toHaveBeenCalled()
    expect(getBriefing.mock.calls).toEqual([
      ['public-investment', { nuts: ['PT16'], volume: 50 }],
      ['corporate-influence', { nuts: ['ES'], volume: 5 }],
    ])
  })

  it('skips a watch whose briefing no longer exists', async () => {
    listMyWatches.mockResolvedValue([{ group_id: 'gone', nuts: [], volume_per_week: 5 }])
    await expect(loadBriefingStream(true)).resolves.toEqual([])
    expect(getBriefing).not.toHaveBeenCalled()
  })

  it('returns nothing when the reader watches nothing, without falling back to the anonymous seed', async () => {
    // A signed-in reader with no watches has made a choice; filling their
    // feed with defaults would override it.
    listMyWatches.mockResolvedValue([])
    await expect(loadBriefingStream(true)).resolves.toEqual([])
    expect(getBriefing).not.toHaveBeenCalled()
  })
})
