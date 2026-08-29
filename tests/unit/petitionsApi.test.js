/**
 * Tests for the Petitions API client (graph API /petitions endpoints).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPetitions, fetchPetitionDetail } from '../../src/api/petitions.js'

const originalFetch = globalThis.fetch
beforeEach(() => { globalThis.fetch = vi.fn() })
afterEach(() => { globalThis.fetch = originalFetch })

const okJson = (data) => ({ ok: true, json: async () => data })

describe('fetchPetitions', () => {
  it('hits /api/petitions with default paging', async () => {
    globalThis.fetch.mockResolvedValue(okJson({ counts: {}, total: 0, results: [] }))
    await fetchPetitions()
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url.startsWith('/api/petitions?')).toBe(true)
    expect(url).toContain('limit=50')
    expect(url).toContain('offset=0')
    expect(url).not.toContain('status=')
    expect(url).not.toContain('sort=')
  })

  it('passes status, statuses and sort when given', async () => {
    globalThis.fetch.mockResolvedValue(okJson({}))
    await fetchPetitions({ status: 'register', statuses: 'a,b', sort: 'recent', limit: 5, offset: 10 })
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url).toContain('status=register')
    expect(url).toContain('statuses=a%2Cb')
    expect(url).toContain('sort=recent')
    expect(url).toContain('limit=5')
    expect(url).toContain('offset=10')
  })

  it('returns the parsed body', async () => {
    globalThis.fetch.mockResolvedValue(okJson({ total: 3 }))
    await expect(fetchPetitions()).resolves.toEqual({ total: 3 })
  })

  it('throws HTTP <status>: <body> on failure', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 502, text: async () => 'bad gateway' })
    await expect(fetchPetitions()).rejects.toThrow('HTTP 502: bad gateway')
  })

  it('keeps the error tail empty when the body is unreadable', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false, status: 500, text: async () => { throw new Error('nope') },
    })
    await expect(fetchPetitions()).rejects.toThrow(/^HTTP 500: $/)
  })
})

describe('fetchPetitionDetail', () => {
  it('sends the id and default system as query params', async () => {
    globalThis.fetch.mockResolvedValue(okJson({}))
    await fetchPetitionDetail('ECI(2024)000001')
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url.startsWith('/api/petitions/detail?')).toBe(true)
    expect(url).toContain('petition_id=ECI%282024%29000001')
    expect(url).toContain('system=eu-eci')
  })

  it('honours an explicit system', async () => {
    globalThis.fetch.mockResolvedValue(okJson({}))
    await fetchPetitionDetail('x', 'de-bt')
    expect(globalThis.fetch.mock.calls[0][0]).toContain('system=de-bt')
  })
})
