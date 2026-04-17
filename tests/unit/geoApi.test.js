/**
 * Tests for the geo API client.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAggregate, fetchBoundaries } from '../../src/api/geo.js'

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = vi.fn()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('fetchAggregate', () => {
  it('defaults to level 0 + companies with no filters', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ regions: [] }),
    })
    await fetchAggregate()
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url).toBe('/api/geo/aggregate?level=0&metric=companies')
  })

  it('serialises level, metric, scopeNuts, connectedToCountry', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ regions: [] }),
    })
    await fetchAggregate({
      level: 3,
      metric: 'contracts_eur',
      scopeNuts: 'DE1',
      connectedToCountry: 'RUS',
    })
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url).toContain('level=3')
    expect(url).toContain('metric=contracts_eur')
    expect(url).toContain('scope_nuts=DE1')
    expect(url).toContain('connected_to_country=RUS')
  })

  it('omits optional params when not set', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ regions: [] }),
    })
    await fetchAggregate({ level: 1, metric: 'contracts' })
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url).not.toContain('scope_nuts')
    expect(url).not.toContain('connected_to_country')
  })

  it('throws on non-OK response', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    })
    await expect(fetchAggregate()).rejects.toThrow(/HTTP 400/)
  })
})

describe('fetchBoundaries', () => {
  it('requests the bundled GeoJSON for the given level', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    })
    await fetchBoundaries(0)
    expect(globalThis.fetch.mock.calls[0][0]).toBe('/api/geo/nuts-boundaries?level=0')
  })

  it('propagates 501 Not Implemented for unbundled levels', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 501,
      text: async () => 'Boundaries for NUTS 3 are not bundled yet.',
    })
    await expect(fetchBoundaries(3)).rejects.toThrow(/HTTP 501/)
  })
})
