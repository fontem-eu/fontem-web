import { _internal } from '../../src/api/session.js'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import * as gmrApi from '../../src/api/gmr.js'
import * as tickersApi from '../../src/api/tickers.js'
import * as communityApi from '../../src/api/community.js'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

afterEach(() => {
  vi.restoreAllMocks()
  _internal.clearForTests(); localStorage.clear()
})

function mockOk(data) {
  return { ok: true, status: 200, json: () => Promise.resolve(data), text: () => Promise.resolve('') }
}
function mock404() {
  return { ok: false, status: 404, text: () => Promise.resolve('Not Found') }
}

describe('gmr.js API', () => {
  it('fetchGmrData calls correct endpoint', async () => {
    mockFetch.mockResolvedValue(mockOk({ ticker: 'AAPL' }))
    const data = await gmrApi.fetchGmrData('AAPL')
    expect(mockFetch).toHaveBeenCalledWith('/api/AAPL/gmr_data?years=10')
    expect(data.ticker).toBe('AAPL')
  })

  it('fetchFundamentals calls correct endpoint with custom years', async () => {
    mockFetch.mockResolvedValue(mockOk({ ticker: 'MSFT' }))
    await gmrApi.fetchFundamentals('MSFT', 5)
    expect(mockFetch).toHaveBeenCalledWith('/api/MSFT/fundamentals?years=5')
  })

  it('fetchValuation calls correct endpoint', async () => {
    mockFetch.mockResolvedValue(mockOk({}))
    await gmrApi.fetchValuation('GOOG')
    expect(mockFetch).toHaveBeenCalledWith('/api/GOOG/valuation?years=10')
  })

  it('fetchPriceHistory passes period param', async () => {
    mockFetch.mockResolvedValue(mockOk([]))
    await gmrApi.fetchPriceHistory('AAPL', '3y')
    expect(mockFetch).toHaveBeenCalledWith('/api/AAPL/prices?period=3y')
  })

  it('throws on non-ok response with body text', async () => {
    mockFetch.mockResolvedValue(mock404())
    await expect(gmrApi.fetchGmrData('BAD')).rejects.toThrow('HTTP 404: Not Found')
  })

  it('fetchPriceHistory defaults to period 1y', async () => {
    mockFetch.mockResolvedValue(mockOk([]))
    await gmrApi.fetchPriceHistory('AAPL')
    expect(mockFetch).toHaveBeenCalledWith('/api/AAPL/prices?period=1y')
  })

  it('fetchFundamentals throws on error response', async () => {
    mockFetch.mockResolvedValue(mock404())
    await expect(gmrApi.fetchFundamentals('BAD')).rejects.toThrow('HTTP 404')
  })

  it('fetchValuation throws on error response', async () => {
    mockFetch.mockResolvedValue(mock404())
    await expect(gmrApi.fetchValuation('BAD')).rejects.toThrow('HTTP 404')
  })

  it('fetchPriceHistory throws on error response', async () => {
    mockFetch.mockResolvedValue(mock404())
    await expect(gmrApi.fetchPriceHistory('BAD')).rejects.toThrow('HTTP 404')
  })

  it('error message includes empty string when res.text() rejects', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: () => Promise.reject(new Error('fail')) })
    await expect(gmrApi.fetchGmrData('X')).rejects.toThrow('HTTP 500: ')
  })

  it('encodes special characters in ticker', async () => {
    mockFetch.mockResolvedValue(mockOk({}))
    await gmrApi.fetchGmrData('A&B')
    expect(mockFetch).toHaveBeenCalledWith('/api/A%26B/gmr_data?years=10')
  })

  it('fetchPriceHistory falls back to empty text when res.text() rejects', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 502, text: () => Promise.reject(new Error('fail')) })
    await expect(gmrApi.fetchPriceHistory('X')).rejects.toThrow('HTTP 502: ')
  })

  it('fetchFundamentals falls back to empty text when res.text() rejects', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, text: () => Promise.reject(new Error('fail')) })
    await expect(gmrApi.fetchFundamentals('X')).rejects.toThrow('HTTP 503: ')
  })

  it('fetchValuation falls back to empty text when res.text() rejects', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 504, text: () => Promise.reject(new Error('fail')) })
    await expect(gmrApi.fetchValuation('X')).rejects.toThrow('HTTP 504: ')
  })
})

describe('tickers.js API', () => {
  it('searchTickers returns empty for blank query', async () => {
    const result = await tickersApi.searchTickers('')
    expect(result.results).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('searchTickers calls search endpoint', async () => {
    mockFetch.mockResolvedValue(mockOk({ query: 'aapl', results: [{ symbol: 'AAPL' }] }))
    const result = await tickersApi.searchTickers('aapl')
    expect(mockFetch).toHaveBeenCalledWith('/api/tickers/search?query=aapl&limit=10')
    expect(result.results).toHaveLength(1)
  })

  it('searchAll returns empty for blank query', async () => {
    const result = await tickersApi.searchAll('')
    expect(result.companies).toEqual([])
    expect(result.authorities).toEqual([])
  })

  it('searchAll calls unified search endpoint', async () => {
    mockFetch.mockResolvedValue(mockOk({ query: 'bank', companies: [], authorities: [] }))
    await tickersApi.searchAll('bank', 5)
    expect(mockFetch).toHaveBeenCalledWith('/api/search?q=bank&limit=5')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue(mock404())
    await expect(tickersApi.searchTickers('xxx')).rejects.toThrow('HTTP 404')
  })

  it('searchTickers returns empty for null query', async () => {
    const result = await tickersApi.searchTickers(null)
    expect(result.results).toEqual([])
    expect(result.query).toBe('')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('searchTickers returns empty for undefined query', async () => {
    const result = await tickersApi.searchTickers(undefined)
    expect(result.results).toEqual([])
    expect(result.query).toBe('')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('searchAll returns empty for null query', async () => {
    const result = await tickersApi.searchAll(null)
    expect(result.companies).toEqual([])
    expect(result.query).toBe('')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('searchAll throws on non-ok response', async () => {
    mockFetch.mockResolvedValue(mock404())
    await expect(tickersApi.searchAll('test')).rejects.toThrow('HTTP 404')
  })

  it('searchAll error includes empty when text() rejects', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, text: () => Promise.reject(new Error('fail')) })
    await expect(tickersApi.searchAll('test')).rejects.toThrow('HTTP 503: ')
  })

  it('searchTickers falls back to empty text when res.text() rejects', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 502, text: () => Promise.reject(new Error('fail')) })
    await expect(tickersApi.searchTickers('test')).rejects.toThrow('HTTP 502: ')
  })
})

describe('community.js API', () => {
  beforeEach(() => {
    _internal.setAccessToken('test-jwt')
  })

  it('createReport sends POST with auth header', async () => {
    mockFetch.mockResolvedValue(mockOk({ id: 'r1', title: 'T' }))
    await communityApi.createReport('T', 'A')
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toBe('/capi/data-stories')
    const opts = call[1]
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer test-jwt')
  })

  it('listReports sends GET', async () => {
    mockFetch.mockResolvedValue(mockOk([]))
    await communityApi.listReports()
    expect(mockFetch).toHaveBeenCalledWith('/capi/data-stories', expect.objectContaining({ method: 'GET' }))
  })

  it('deleteReport sends DELETE and returns null for 204', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })
    const result = await communityApi.deleteReport('r1')
    expect(result).toBeNull()
  })

  it('createIssue sends POST', async () => {
    mockFetch.mockResolvedValue(mockOk({ id: 'i1' }))
    await communityApi.createIssue({ title: 'Bug', issue_type: 'other' })
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toBe('/capi/issues')
    expect(JSON.parse(call[1].body).title).toBe('Bug')
  })

  it('voteIssue sends POST with direction', async () => {
    mockFetch.mockResolvedValue(mockOk({}))
    await communityApi.voteIssue('i1', 'up')
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toBe('/capi/issues/i1/vote')
    expect(JSON.parse(call[1].body).direction).toBe('up')
  })

  it('getCurrentUser calls /users/me', async () => {
    mockFetch.mockResolvedValue(mockOk({ id: 'u1', name: 'Alice' }))
    const user = await communityApi.getCurrentUser()
    expect(user.name).toBe('Alice')
  })

  it('throws with detail on error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403, text: () => Promise.resolve('Forbidden') })
    await expect(communityApi.listReports()).rejects.toThrow('HTTP 403')
  })
})
