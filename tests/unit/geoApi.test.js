/**
 * Tests for the geo API client.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchBoundaries } from '../../src/api/geo.js'

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = vi.fn()
})

afterEach(() => {
  globalThis.fetch = originalFetch
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
