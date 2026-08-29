/**
 * Tests for the Public Spending (euro-tracker) API client.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchMyCountry, fetchRecommendations } from '../../src/api/euroTracker.js'

const originalFetch = globalThis.fetch
beforeEach(() => { globalThis.fetch = vi.fn() })
afterEach(() => { globalThis.fetch = originalFetch })

describe('fetchMyCountry', () => {
  it('hits /api/euro-tracker/me/country', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({ country: null }) })
    await expect(fetchMyCountry()).resolves.toEqual({ country: null })
    expect(globalThis.fetch.mock.calls[0][0].startsWith('/api/euro-tracker/me/country')).toBe(true)
  })

  it('throws HTTP <status>: <body> on failure', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 503, text: async () => 'down' })
    await expect(fetchMyCountry()).rejects.toThrow('HTTP 503: down')
  })

  it('keeps the error tail empty when the body is unreadable', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false, status: 500, text: async () => { throw new Error('nope') },
    })
    await expect(fetchMyCountry()).rejects.toThrow(/^HTTP 500: $/)
  })
})

describe('fetchRecommendations', () => {
  it('requires a country', async () => {
    await expect(fetchRecommendations('')).rejects.toThrow('country is required')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('sends country and default limit', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await fetchRecommendations('PRT')
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url.startsWith('/api/euro-tracker/recommendations?')).toBe(true)
    expect(url).toContain('country=PRT')
    expect(url).toContain('limit=10')
  })

  it('honours an explicit limit', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await fetchRecommendations('DEU', { limit: 3 })
    expect(globalThis.fetch.mock.calls[0][0]).toContain('limit=3')
  })
})
