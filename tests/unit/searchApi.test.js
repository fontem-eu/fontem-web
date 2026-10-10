/**
 * Tests for the unified search client (graph fan-out + story search).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchGraph, searchStories } from '../../src/api/search.js'
import { request } from '../../src/api/community.js'

vi.mock('../../src/api/community.js', () => ({ request: vi.fn() }))

const originalFetch = globalThis.fetch
beforeEach(() => {
  globalThis.fetch = vi.fn()
  request.mockReset()
  request.mockResolvedValue([])
})
afterEach(() => { globalThis.fetch = originalFetch })

describe('searchGraph', () => {
  it('returns the empty shape without fetching when the query is blank', async () => {
    await expect(searchGraph({ q: '  ' })).resolves.toEqual(
      { query: '', types: [], counts: {}, results: [], has_more: false })
    await expect(searchGraph({ q: '' })).resolves.toEqual(
      { query: '', types: [], counts: {}, results: [], has_more: false })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('builds the faceted query string, trimming and joining types', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
    await searchGraph({
      q: ' siemens ', types: ['company', 'person'], country: 'DE',
      nuts: 'DE21', dateFrom: '2024-01-01', dateTo: '2024-12-31', limit: 5, offset: 15,
    })
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url.startsWith('/api/search/results?')).toBe(true)
    expect(url).toContain('q=siemens')
    expect(url).toContain('types=company%2Cperson')
    expect(url).toContain('country=DE')
    expect(url).toContain('nuts=DE21')
    expect(url).toContain('date_from=2024-01-01')
    expect(url).toContain('date_to=2024-12-31')
    expect(url).toContain('limit=5')
    expect(url).toContain('offset=15')
  })

  it('asks the index for cohesion grants by its own name for them', async () => {
    // The page says `cohesion`, the index `eu_cohesion`; unmapped, no grant
    // was ever found from the site.
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
    await searchGraph({ q: 'port', types: ['contract', 'cohesion'] })
    expect(globalThis.fetch.mock.calls[0][0]).toContain('types=contract%2Ceu_cohesion')
  })

  it('hands grants back to the page under its name for them', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ type: 'eu_cohesion', id: 'Q1' }, { type: 'contract', id: 'n1' }],
        counts: { eu_cohesion: 1, contract: 1 },
        has_more: false,
      }),
    })
    const out = await searchGraph({ q: 'port' })
    expect(out.results.map((r) => r.type)).toEqual(['cohesion', 'contract'])
    expect(out.counts).toEqual({ cohesion: 1, contract: 1 })
    expect(out.has_more).toBe(false)
  })

  it('asks the index for lobbyists and petitions by its own names for them', async () => {
    // The index holds 18,710 `eu_lobbying` entries; asked for `lobbyist`, it
    // returned none of them, so no search on the site found a lobbyist.
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
    await searchGraph({ q: 'brewers', types: ['lobbyist', 'petition'] })
    expect(globalThis.fetch.mock.calls[0][0]).toContain('types=eu_lobbying%2Cpetition')
  })

  it('hands lobbying entries back to the page as lobbyists', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ type: 'eu_lobbying', id: 'L1' }, { type: 'petition', id: 'ECI(2024)000007' }],
        counts: { eu_lobbying: 1, petition: 1 },
        has_more: false,
      }),
    })
    const out = await searchGraph({ q: 'brewers' })
    expect(out.results.map((r) => r.type)).toEqual(['lobbyist', 'petition'])
    expect(out.counts).toEqual({ lobbyist: 1, petition: 1 })
  })

  it('drops empty facets and empty type arrays from the query string', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await searchGraph({ q: 'x', types: [], country: '', nuts: null })
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url).not.toContain('types=')
    expect(url).not.toContain('country=')
    expect(url).not.toContain('nuts=')
  })

  it('throws HTTP <status>: <body> on failure, empty tail when unreadable', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' })
    await expect(searchGraph({ q: 'x' })).rejects.toThrow('HTTP 500: boom')
    globalThis.fetch.mockResolvedValue({
      ok: false, status: 502, text: async () => { throw new Error('nope') },
    })
    await expect(searchGraph({ q: 'x' })).rejects.toThrow(/^HTTP 502: $/)
  })
})

describe('searchStories', () => {
  it('returns [] without calling the API when the query is blank', async () => {
    await expect(searchStories({ q: ' ' })).resolves.toEqual([])
    expect(request).not.toHaveBeenCalled()
  })

  it('GETs /data-stories/search with the trimmed query and paging', async () => {
    await searchStories({ q: ' water ', dateFrom: '2024-01-01', limit: 7, offset: 21 })
    const [method, path] = request.mock.calls[0]
    expect(method).toBe('GET')
    expect(path.startsWith('/data-stories/search?')).toBe(true)
    expect(path).toContain('q=water')
    expect(path).toContain('date_from=2024-01-01')
    expect(path).toContain('limit=7')
    expect(path).toContain('offset=21')
    expect(path).not.toContain('date_to=')
  })
})
