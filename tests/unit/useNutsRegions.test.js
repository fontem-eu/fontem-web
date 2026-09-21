/**
 * Shared NUTS region cache — one fetch per page load, retry on failure.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/api/geo.js', () => ({
  fetchNutsRegions: vi.fn(),
  fetchNutsSearchIndex: vi.fn(),
}))

let lang = 'en'
vi.mock('../../src/composables/useLang.js', () => ({ currentLang: () => lang }))

import { fetchNutsRegions, fetchNutsSearchIndex } from '../../src/api/geo.js'
import { useNutsRegions, __resetNutsCache } from '../../src/composables/useNutsRegions.js'

const REGIONS = [{ code: 'DE11', name: 'Stuttgart', level: 2 }]
const REGIONS_EL = [{ code: 'DE11', name: 'Στουτγκάρδη', level: 2 }]

beforeEach(() => {
  __resetNutsCache()
  lang = 'en'
  fetchNutsRegions.mockReset()
  fetchNutsSearchIndex.mockReset()
})

describe('useNutsRegions', () => {
  it('loads once and shares the result', async () => {
    fetchNutsRegions.mockResolvedValue({ regions: REGIONS })
    const a = useNutsRegions()
    await expect(a.load()).resolves.toEqual(REGIONS)
    expect(a.regions.value).toEqual(REGIONS)
    // second load is served from the cache
    await a.load()
    expect(fetchNutsRegions).toHaveBeenCalledTimes(1)
  })

  it('concurrent callers share one in-flight request', async () => {
    let resolve
    fetchNutsRegions.mockReturnValue(new Promise((r) => { resolve = r }))
    const a = useNutsRegions()
    const b = useNutsRegions()
    const p1 = a.load()
    const p2 = b.load()
    resolve({ regions: REGIONS })
    await expect(p1).resolves.toEqual(REGIONS)
    await expect(p2).resolves.toEqual(REGIONS)
    expect(fetchNutsRegions).toHaveBeenCalledTimes(1)
  })

  it('a failed fetch records the error and allows a retry', async () => {
    fetchNutsRegions.mockRejectedValueOnce(new Error('geo down'))
    const u = useNutsRegions()
    await expect(u.load()).resolves.toEqual([])
    expect(u.error.value).toBe('geo down')
    fetchNutsRegions.mockResolvedValue({ regions: REGIONS })
    await expect(u.load()).resolves.toEqual(REGIONS)
    expect(fetchNutsRegions).toHaveBeenCalledTimes(2)
  })

  it('tolerates a payload without regions', async () => {
    fetchNutsRegions.mockResolvedValue({})
    await expect(useNutsRegions().load()).resolves.toEqual([])
  })

  it('reloads when the language changes', async () => {
    /** Names are localised server-side, so the cached list belongs to the
     *  language it was fetched in — keeping it would leave a reader who
     *  switched to Greek looking at English region names. */
    fetchNutsRegions.mockResolvedValue({ regions: REGIONS })
    const u = useNutsRegions()
    await u.load()
    fetchNutsRegions.mockResolvedValue({ regions: REGIONS_EL })
    lang = 'el'
    await expect(u.load()).resolves.toEqual(REGIONS_EL)
    expect(fetchNutsRegions).toHaveBeenCalledTimes(2)
  })

  it('loads the search index separately, once', async () => {
    fetchNutsSearchIndex.mockResolvedValue({ terms: { DE11: 'stuttgart' } })
    const u = useNutsRegions()
    await u.loadSearchIndex()
    await u.loadSearchIndex()
    expect(u.searchTerms.value).toEqual({ DE11: 'stuttgart' })
    expect(fetchNutsSearchIndex).toHaveBeenCalledTimes(1)
  })

  it('keeps the index out of the language-keyed cache', async () => {
    /** The index carries every language at once, so a language switch is
     *  no reason to fetch 116 KB again. */
    fetchNutsRegions.mockResolvedValue({ regions: REGIONS })
    fetchNutsSearchIndex.mockResolvedValue({ terms: { DE11: 'stuttgart' } })
    const u = useNutsRegions()
    await u.load()
    await u.loadSearchIndex()
    lang = 'el'
    await u.load()
    await u.loadSearchIndex()
    expect(fetchNutsSearchIndex).toHaveBeenCalledTimes(1)
  })

  it('a failed index leaves matching to the visible names', async () => {
    fetchNutsSearchIndex.mockRejectedValue(new Error('geo down'))
    const u = useNutsRegions()
    await expect(u.loadSearchIndex()).resolves.toEqual({})
    expect(u.error.value).toBeNull()
  })
})
