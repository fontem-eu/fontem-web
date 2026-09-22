/**
 * Shared NUTS region cache — one fetch per page load, retry on failure.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/api/nuts.js', () => ({ fetchNutsRegions: vi.fn() }))

let lang = 'en'
vi.mock('../../src/composables/useLang.js', () => ({ currentLang: () => lang }))

import { fetchNutsRegions } from '../../src/api/nuts.js'
import { useNutsRegions, __resetNutsCache } from '../../src/composables/useNutsRegions.js'

const REGIONS = [{ code: 'DE11', name: 'Stuttgart', level: 2 }]
const REGIONS_EL = [{ code: 'DE11', name: 'Στουτγκάρδη', level: 2 }]

beforeEach(() => {
  __resetNutsCache()
  lang = 'en'
  fetchNutsRegions.mockReset()
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

  it('leaves searching to the server', async () => {
    /** The composable used to fetch a folded index for the component to rank
     *  against. /api/nuts/search ranks across all 24 languages server-side,
     *  so the second implementation — and the folding contract it had to
     *  honour — is gone. */
    const u = useNutsRegions()
    expect(Object.keys(u)).toEqual(['regions', 'error', 'load'])
  })

})
