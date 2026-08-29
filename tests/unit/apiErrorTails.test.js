/**
 * Pin the shared error idiom of the plain-fetch API clients:
 *   const text = await res.text().catch(() => '')
 *   throw new Error(`HTTP ${status}: ${text}`)
 * The catch must yield an EMPTY tail (not undefined, not junk) when the
 * body is unreadable — surviving mutants here mean garbled error UI.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchGmrData, fetchFundamentals, fetchValuation, fetchPriceHistory } from '../../src/api/gmr.js'
import { searchTickers, searchAll } from '../../src/api/tickers.js'
import { fetchSeries } from '../../src/api/atlas.js'

const originalFetch = globalThis.fetch
beforeEach(() => { globalThis.fetch = vi.fn() })
afterEach(() => { globalThis.fetch = originalFetch })

const unreadable = { ok: false, status: 500, text: async () => { throw new Error('gone') } }

describe('unreadable error bodies produce an empty tail', () => {
  it.each([
    ['fetchGmrData', () => fetchGmrData('SIE')],
    ['fetchFundamentals', () => fetchFundamentals('SIE')],
    ['fetchValuation', () => fetchValuation('SIE')],
    ['fetchPriceHistory', () => fetchPriceHistory('SIE')],
    ['searchTickers', () => searchTickers('sie')],
    ['searchAll', () => searchAll('sie')],
    ['fetchSeries', () => fetchSeries({ dataset: 'gdp', nutsLevel: 0 })],
  ])('%s', async (_name, call) => {
    globalThis.fetch.mockResolvedValue(unreadable)
    await expect(call()).rejects.toThrow(/^HTTP 500: $/)
  })

  it('keeps the readable body in the message', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 404, text: async () => 'no such ticker' })
    await expect(fetchGmrData('NOPE')).rejects.toThrow('HTTP 404: no such ticker')
  })
})

describe('tickers blank-query short-circuits', () => {
  it('searchTickers returns the empty shape without fetching', async () => {
    await expect(searchTickers('   ')).resolves.toEqual(
      { query: '   ', results: [], count: 0, total_available: 0 })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('searchAll returns the empty shape without fetching', async () => {
    await expect(searchAll('')).resolves.toEqual({ query: '', companies: [], authorities: [] })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
