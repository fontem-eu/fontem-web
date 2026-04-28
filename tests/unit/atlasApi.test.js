/**
 * Tests for the Atlas API client (datasets + series + snapshot + health).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchHealth, fetchDatasets, fetchDatasetDetail, fetchSeries, fetchSnapshot,
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

describe('fetchDatasetDetail', () => {
  it('encodes the code into the path', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await fetchDatasetDetail('demo_r_pjangrp3')
    expect(globalThis.fetch.mock.calls[0][0])
      .toContain('/api/atlas/datasets/demo_r_pjangrp3')
  })

  it('requires a code', async () => {
    await expect(fetchDatasetDetail()).rejects.toThrow(/code/)
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

describe('fetchSnapshot', () => {
  it('requires dataset, year, nutsLevel', async () => {
    await expect(fetchSnapshot({ year: 2023, nutsLevel: 2 })).rejects.toThrow(/dataset/)
    await expect(fetchSnapshot({ dataset: 'x', nutsLevel: 2 })).rejects.toThrow(/year/)
    await expect(fetchSnapshot({ dataset: 'x', year: 2023 })).rejects.toThrow(/nutsLevel/)
  })

  it('hits /api/atlas/snapshot with the right params', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ cells: [] }) })
    await fetchSnapshot({
      dataset: 'nama_10r_2gdp', year: 2023, nutsLevel: 2,
      dimensions: { unit: 'MIO_EUR' },
    })
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url).toContain('/api/atlas/snapshot')
    expect(url).toContain('dataset=nama_10r_2gdp')
    expect(url).toContain('year=2023')
    expect(url).toContain('nuts_level=2')
    expect(decodeURIComponent(url)).toContain('"unit":"MIO_EUR"')
  })

  it('omits dimensions when empty', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ cells: [] }) })
    await fetchSnapshot({ dataset: 'x', year: 2023, nutsLevel: 2 })
    expect(globalThis.fetch.mock.calls[0][0]).not.toContain('dimensions=')
  })
})
