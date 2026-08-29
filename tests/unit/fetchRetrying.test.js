/**
 * A 429 from the platform's own rate limiter is absorbed, not surfaced.
 *
 * The limiter keys on client IP, so parallel tabs — or an office behind
 * one NAT — share a single token bucket and a legitimate SPA burst can
 * trip it. The promote gate hit exactly this (STORY-FLOWERS-3, run
 * 28166): three atlas requests 429'd mid-suite and a widget just went
 * empty. The wrapper retries GETs with backoff; writes pass through.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchRetrying, rateLimited } from '../../src/api/_retry.js'

function res(status, retryAfter) {
  return {
    status,
    headers: new Headers(retryAfter ? { 'retry-after': String(retryAfter) } : {}),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  rateLimited.value = false
})

describe('fetchRetrying', () => {
  it('retries a 429 GET and reports while waiting', async () => {
    vi.useFakeTimers()
    const f = vi.fn()
      .mockResolvedValueOnce(res(429, 1))
      .mockResolvedValueOnce(res(200))
    vi.stubGlobal('fetch', f)

    const p = fetchRetrying('/api/atlas/series')
    await vi.advanceTimersByTimeAsync(1)
    // The note is up while the retry waits — the user is told, not left
    // staring at an empty widget.
    expect(rateLimited.value).toBe(true)

    await vi.advanceTimersByTimeAsync(5000)
    const out = await p
    expect(out.status).toBe(200)
    expect(f).toHaveBeenCalledTimes(2)
    expect(rateLimited.value).toBe(false)
  })

  it('gives up after two retries and returns the 429', async () => {
    vi.useFakeTimers()
    const f = vi.fn().mockResolvedValue(res(429))
    vi.stubGlobal('fetch', f)

    const p = fetchRetrying('/api/atlas/series')
    await vi.advanceTimersByTimeAsync(20000)
    const out = await p
    expect(out.status).toBe(429)
    expect(f).toHaveBeenCalledTimes(3)
    // No retry pending any more — the note must come down even though
    // the request ultimately failed.
    expect(rateLimited.value).toBe(false)
  })

  it('never retries a write — a doubled POST is worse than a 429', async () => {
    const f = vi.fn().mockResolvedValue(res(429))
    vi.stubGlobal('fetch', f)
    const out = await fetchRetrying('/capi/data-stories', { method: 'POST' })
    expect(out.status).toBe(429)
    expect(f).toHaveBeenCalledTimes(1)
    expect(rateLimited.value).toBe(false)
  })

  it('passes non-429 responses through untouched', async () => {
    const f = vi.fn().mockResolvedValue(res(500))
    vi.stubGlobal('fetch', f)
    const out = await fetchRetrying('/api/x')
    expect(out.status).toBe(500)
    expect(f).toHaveBeenCalledTimes(1)
  })
})
