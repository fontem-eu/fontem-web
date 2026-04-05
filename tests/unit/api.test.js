import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import * as gmrApi from '../../src/api/gmr.js'
import * as tickersApi from '../../src/api/tickers.js'
import * as communityApi from '../../src/api/community.js'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
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
})

describe('community.js API', () => {
  beforeEach(() => {
    localStorage.setItem('gmr-token', 'test-jwt')
  })

  it('createReport sends POST with auth header', async () => {
    mockFetch.mockResolvedValue(mockOk({ id: 'r1', title: 'T' }))
    await communityApi.createReport('T', 'A')
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toBe('/capi/reports')
    const opts = call[1]
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer test-jwt')
  })

  it('listReports sends GET', async () => {
    mockFetch.mockResolvedValue(mockOk([]))
    await communityApi.listReports()
    expect(mockFetch).toHaveBeenCalledWith('/capi/reports', expect.objectContaining({ method: 'GET' }))
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
