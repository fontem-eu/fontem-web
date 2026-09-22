/**
 * The NUTS API client — the app's half of the public /api/nuts contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchNutsRegions, searchNutsRegions } from '../../src/api/nuts.js'

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ regions: [], matches: [] }),
  })
})
afterEach(() => { globalThis.fetch = originalFetch })

const lastUrl = () => globalThis.fetch.mock.calls.at(-1)[0]

describe('fetchNutsRegions', () => {
  it('asks for one language and the whole classification', async () => {
    /** `names=none` drops the other 23 languages and the aliases — three
     *  quarters of the payload for an app that shows one language. The limit
     *  is above the size of the classification so it arrives in one call. */
    await fetchNutsRegions()
    expect(lastUrl()).toContain('/api/nuts/regions?')
    expect(lastUrl()).toContain('names=none')
    expect(lastUrl()).toContain('limit=5000')
  })

  it('narrows to the codes asked for', async () => {
    await fetchNutsRegions({ codes: ['EL3', 'PT1A0'] })
    expect(lastUrl()).toContain('codes=EL3%2CPT1A0')
  })

  it('does not pay for a round trip to be told nothing matches nothing', async () => {
    await expect(fetchNutsRegions({ codes: [] })).resolves.toEqual({ regions: [] })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('caps the depth when the caller does', async () => {
    await fetchNutsRegions({ maxLevel: 0 })
    expect(lastUrl()).toContain('max_level=0')
  })
})

describe('searchNutsRegions', () => {
  it('sends the query, the depth cap and a limit', async () => {
    await searchNutsRegions('  Lisbonne ', { maxLevel: 2, limit: 10 })
    expect(lastUrl()).toContain('q=Lisbonne')
    expect(lastUrl()).toContain('max_level=2')
    expect(lastUrl()).toContain('limit=10')
  })

  it('answers an empty query without asking the server', async () => {
    await expect(searchNutsRegions('   ')).resolves.toEqual({ matches: [] })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('passes an abort signal through, so a stale query can be dropped', async () => {
    const controller = new AbortController()
    await searchNutsRegions('att', { signal: controller.signal })
    expect(globalThis.fetch.mock.calls.at(-1)[1].signal).toBe(controller.signal)
  })
})
