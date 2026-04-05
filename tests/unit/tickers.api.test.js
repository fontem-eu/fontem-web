import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchTickers } from '../../src/api/tickers.js'

describe('searchTickers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches and returns results for a valid query', async () => {
    const mockData = {
      query: 'apple',
      results: [{ symbol: 'AAPL', name: 'Apple Inc.' }],
      count: 1,
      total_available: 10416,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    )

    const result = await searchTickers('apple')

    expect(fetch).toHaveBeenCalledWith('/api/tickers/search?query=apple&limit=10')
    expect(result.results).toHaveLength(1)
    expect(result.results[0].symbol).toBe('AAPL')
    expect(result.count).toBe(1)
  })

  it('uses a custom limit when provided', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ query: 'x', results: [], count: 0, total_available: 0 }),
      })
    )

    await searchTickers('x', 25)
    expect(fetch).toHaveBeenCalledWith('/api/tickers/search?query=x&limit=25')
  })

  it('encodes special characters in the query', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ query: 'a&b', results: [], count: 0, total_available: 0 }),
      })
    )

    await searchTickers('a&b')
    expect(fetch).toHaveBeenCalledWith('/api/tickers/search?query=a%26b&limit=10')
  })

  it('trims whitespace from the query before fetching', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ query: 'aapl', results: [], count: 0, total_available: 0 }),
      })
    )

    await searchTickers('  aapl  ')
    expect(fetch).toHaveBeenCalledWith('/api/tickers/search?query=aapl&limit=10')
  })

  it('returns an empty result immediately for a blank query', async () => {
    vi.stubGlobal('fetch', vi.fn())

    const result = await searchTickers('')
    expect(fetch).not.toHaveBeenCalled()
    expect(result.results).toHaveLength(0)
  })

  it('returns an empty result immediately for a whitespace-only query', async () => {
    vi.stubGlobal('fetch', vi.fn())

    const result = await searchTickers('   ')
    expect(fetch).not.toHaveBeenCalled()
    expect(result.results).toHaveLength(0)
  })

  it('throws an error on a non-OK HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('Internal Server Error') }))
    await expect(searchTickers('apple')).rejects.toThrow('HTTP 500')
  })
})
