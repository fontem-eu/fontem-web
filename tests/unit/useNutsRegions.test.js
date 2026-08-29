/**
 * Shared NUTS region cache — one fetch per page load, retry on failure.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/api/geo.js', () => ({ fetchNutsRegions: vi.fn() }))

import { fetchNutsRegions } from '../../src/api/geo.js'
import { useNutsRegions, __resetNutsCache } from '../../src/composables/useNutsRegions.js'

const REGIONS = [{ code: 'DE11', name: 'Stuttgart', level: 2 }]

beforeEach(() => {
  __resetNutsCache()
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
})
