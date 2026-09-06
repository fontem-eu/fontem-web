/**
 * Codes here are real ones from the production feed, with the names the
 * catalogue actually returns — including the awkward pairs, which are the
 * reason this has any logic at all.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/api/geo.js', () => ({ fetchNutsRegions: vi.fn() }))

const { fetchNutsRegions } = await import('../../src/api/geo.js')
const {
  chainFor, loadNutsLabels, nutsLabel, _resetNutsLabelsForTests,
} = await import('../../src/composables/useNutsLabels.js')

// Real chains, verified against /api/geo/nuts-regions.
const CATALOGUE = {
  CZ010: 'Hlavní město Praha', CZ01: 'Praha', CZ0: 'Česko',
  IE061: 'Dublin', IE06: 'Eastern and Midland', IE0: 'Ireland',
  FRI12: 'Gironde', FRI1: 'Aquitaine', FRI: 'Nouvelle-Aquitaine',
  PT192: 'Região de Coimbra', PT19: 'Centro (PT)', PT1: 'Continente',
}

beforeEach(() => {
  _resetNutsLabelsForTests()
  vi.clearAllMocks()
  fetchNutsRegions.mockImplementation(async (codes) => ({
    regions: (codes || []).filter((c) => c in CATALOGUE)
      .map((c) => ({ code: c, name: CATALOGUE[c] })),
  }))
})
afterEach(() => vi.restoreAllMocks())

describe('chainFor', () => {
  it('walks NUTS 3 -> 2 -> 1 by slicing the code', () => {
    // The hierarchy is in the string: a child's code is its parent's plus
    // a character, so this needs no lookup.
    expect(chainFor('CZ010')).toEqual(['CZ010', 'CZ01', 'CZ0'])
  })

  it('has no chain to walk for a country or the synthetic EU', () => {
    expect(chainFor('PT')).toEqual(['PT'])
    expect(chainFor('EU')).toEqual(['EU'])
  })

  it('is unbothered by case and whitespace', () => {
    expect(chainFor(' cz010 ')).toEqual(['CZ010', 'CZ01', 'CZ0'])
  })

  it('has nothing to say about nothing', () => {
    expect(chainFor(undefined)).toEqual([])
    expect(chainFor('')).toEqual([])
  })
})

describe('nutsLabel', () => {
  it('reads as a place, not a code', async () => {
    const items = [{ nuts: ['CZ010'] }]
    await loadNutsLabels(items)
    expect(nutsLabel(items[0])).toBe('Hlavní město Praha › Praha › Česko')
  })

  it('drops a repeated name rather than saying it twice', async () => {
    // Several countries name a NUTS-1 the same as its NUTS-2. Repeating it
    // reads like a bug rather than a hierarchy.
    const items = [{ nuts: ['IE061'] }]
    await loadNutsLabels(items)
    expect(nutsLabel(items[0])).toBe('Dublin › Eastern and Midland › Ireland')
  })

  it('asks for every code on screen in ONE request', async () => {
    // A dozen cards mounting at once must not make a dozen calls.
    const items = [{ nuts: ['CZ010'] }, { nuts: ['IE061'] }, { nuts: ['FRI12'] }]
    await loadNutsLabels(items)
    expect(fetchNutsRegions).toHaveBeenCalledTimes(1)
    expect(fetchNutsRegions.mock.calls[0][0]).toHaveLength(9)
  })

  it('does not re-request what it already knows', async () => {
    const items = [{ nuts: ['CZ010'] }]
    await loadNutsLabels(items)
    await loadNutsLabels(items)
    expect(fetchNutsRegions).toHaveBeenCalledTimes(1)
  })

  it('remembers a miss, so an unknown code is not asked for forever', async () => {
    // 'EU' is not in the catalogue. Without caching the miss, every render
    // would ask again.
    const items = [{ nuts: ['EU'] }]
    await loadNutsLabels(items)
    await loadNutsLabels(items)
    expect(fetchNutsRegions).toHaveBeenCalledTimes(1)
  })

  it('falls back to the code when the catalogue has no name for it', async () => {
    const items = [{ nuts: ['EU'] }]
    await loadNutsLabels(items)
    expect(nutsLabel(items[0])).toBe('EU')
  })

  it('names what it can rather than mixing a code in with them', async () => {
    // A retired vintage: the leaf is gone but an ancestor remains.
    // "PT165 › Continente" would read as neither a code nor a place.
    fetchNutsRegions.mockResolvedValue({
      regions: [{ code: 'PT1', name: 'Continente' }],
    })
    const items = [{ nuts: ['PT165'] }]
    await loadNutsLabels(items)
    expect(nutsLabel(items[0])).toBe('Continente')
  })

  it('says nothing when the item has no region', async () => {
    expect(nutsLabel({ nuts: [] })).toBe('')
    expect(nutsLabel({})).toBe('')
  })

  it('never fails the feed over a missing label', async () => {
    // The headline and the destination are the point; the place is an
    // enrichment.
    fetchNutsRegions.mockRejectedValue(new Error('geo is down'))
    const items = [{ nuts: ['CZ010'] }]
    await expect(loadNutsLabels(items)).resolves.toBeUndefined()
    expect(nutsLabel(items[0])).toBe('CZ010')
  })
})
