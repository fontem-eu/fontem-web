/**
 * Tests for the Atlas API client (health + datasets + series).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchHealth, fetchDatasets, fetchSeries,
} from '../../src/api/atlas.js'

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = vi.fn()
})
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('fetchHealth', () => {
  it('hits /api/atlas/health', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true, json: async () => ({ status: 'ok', sources: [] }),
    })
    await fetchHealth()
    expect(globalThis.fetch.mock.calls[0][0].startsWith('/api/atlas/health'))
      .toBe(true)
  })
})

describe('fetchDatasets', () => {
  it('hits /api/atlas/datasets', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => [] })
    await fetchDatasets()
    expect(globalThis.fetch.mock.calls[0][0].startsWith('/api/atlas/datasets'))
      .toBe(true)
  })

  it('throws on non-OK response', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false, status: 500, text: async () => 'oops',
    })
    await expect(fetchDatasets()).rejects.toThrow(/HTTP 500/)
  })
})

describe('fetchSeries', () => {
  it('requires dataset', async () => {
    await expect(fetchSeries({ geo: ['DE'] })).rejects.toThrow(/dataset/)
  })

  it('requires either geo or nutsLevel', async () => {
    await expect(fetchSeries({ dataset: 'x' })).rejects.toThrow(/geo|nutsLevel/i)
  })

  it('serialises an explicit geo list', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await fetchSeries({ dataset: 'nama_10r_2gdp', geo: ['DE', 'FR'] })
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url).toContain('/api/atlas/series')
    expect(url).toContain('dataset=nama_10r_2gdp')
    expect(url).toContain('geo=DE')
    expect(url).toContain('geo=FR')
  })

  it('serialises nutsLevel into nuts_level', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await fetchSeries({ dataset: 'nama_10r_2gdp', nutsLevel: 2 })
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url).toContain('nuts_level=2')
    expect(url).not.toContain('geo=')
  })

  it('serialises start, end, dimensions', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await fetchSeries({
      dataset: 'demo_r_pjangrp3', nutsLevel: 2,
      start: 2010, end: 2020,
      dimensions: { sex: 'T', age: 'TOTAL' },
    })
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url).toContain('start=2010')
    expect(url).toContain('end=2020')
    expect(decodeURIComponent(url)).toContain('"sex":"T"')
    expect(decodeURIComponent(url)).toContain('"age":"TOTAL"')
  })

  it('omits dimensions when empty object', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await fetchSeries({ dataset: 'x', geo: ['DE'], dimensions: {} })
    expect(globalThis.fetch.mock.calls[0][0]).not.toContain('dimensions=')
  })
})
