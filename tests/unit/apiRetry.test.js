import { describe, it, expect, vi } from 'vitest'
import {
  RETRYABLE, MAX_ATTEMPTS, SLOW_FAILURE_MS, backoffMs, retryAfterMs,
  withRetry, worthRetrying,
} from '../../src/api/retry.js'

// Three e2e tests failed on the same event and none of them said so:
// TRANS-01 left an English title under a Portuguese picker, SPARQL-EDITOR
// reported "Query failed: HTTP 429" for good, and FEED-TAG-PERSIST turned
// the failure into a null id. All three were one unretried 429.

const res = (status, headers = {}) => ({
  status,
  ok: status < 400,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
})

describe('which statuses are worth another go', () => {
  it('retries a rate limit', () => {
    expect(RETRYABLE.has(429)).toBe(true)
  })

  it('retries the gateway statuses and a request timeout', () => {
    for (const s of [408, 502, 504]) expect(RETRYABLE.has(s)).toBe(true)
  })

  it('does not retry the ones that mean "no"', () => {
    // A 500 may well be permanent, and 4xx other than the two above are
    // the caller's problem — retrying them is just noise on a broken thing.
    // 503 sits here on purpose: this codebase uses it for "not
    // configured", which no amount of retrying will change.
    for (const s of [400, 401, 403, 404, 422, 500, 503]) {
      expect(RETRYABLE.has(s)).toBe(false)
    }
  })
})

describe('how long to wait', () => {
  it('backs off, and not in lockstep with a flat delay', () => {
    expect(backoffMs(0)).toBe(300)
    expect(backoffMs(1)).toBe(900)
    expect(backoffMs(2)).toBe(2700)
  })

  it('honours Retry-After in seconds', () => {
    expect(retryAfterMs('2')).toBe(2000)
  })

  it('honours Retry-After as a date', () => {
    const now = Date.parse('2026-08-15T10:00:00Z')
    expect(retryAfterMs('Sat, 15 Aug 2026 10:00:03 GMT', now)).toBe(3000)
  })

  it('caps an absurd Retry-After rather than hanging the page', () => {
    expect(retryAfterMs('3600')).toBe(5000)
  })

  it('ignores a header it cannot read instead of guessing', () => {
    expect(retryAfterMs('soon')).toBeNull()
    expect(retryAfterMs(null)).toBeNull()
  })

  it('never waits a negative time for a date already past', () => {
    const now = Date.parse('2026-08-15T10:00:00Z')
    expect(retryAfterMs('Sat, 15 Aug 2026 09:59:00 GMT', now)).toBe(0)
  })
})

describe('withRetry', () => {
  const sleep = vi.fn().mockResolvedValue()

  it('returns a good response without retrying', async () => {
    const send = vi.fn().mockResolvedValue(res(200))
    expect((await withRetry(send, { sleep })).status).toBe(200)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('retries a 429 and returns the eventual success', async () => {
    // The exact SPARQL-EDITOR failure, and its fix.
    const send = vi.fn()
      .mockResolvedValueOnce(res(429))
      .mockResolvedValueOnce(res(200))
    const out = await withRetry(send, { sleep })
    expect(out.status).toBe(200)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('gives up after the attempt limit and hands back the last response', async () => {
    // It must not pretend to succeed, and it must not loop forever.
    const send = vi.fn().mockResolvedValue(res(429))
    const out = await withRetry(send, { sleep })
    expect(out.status).toBe(429)
    expect(send).toHaveBeenCalledTimes(MAX_ATTEMPTS)
  })

  it('waits what the server asked for', async () => {
    const waits = []
    const send = vi.fn()
      .mockResolvedValueOnce(res(429, { 'retry-after': '1' }))
      .mockResolvedValueOnce(res(200))
    await withRetry(send, { sleep: async (ms) => { waits.push(ms) } })
    expect(waits).toEqual([1000])
  })

  it('falls back to backoff when the server said nothing', async () => {
    const waits = []
    const send = vi.fn()
      .mockResolvedValueOnce(res(429))
      .mockResolvedValueOnce(res(200))
    await withRetry(send, { sleep: async (ms) => { waits.push(ms) } })
    expect(waits).toEqual([300])
  })

  it('does not retry a 404', async () => {
    const send = vi.fn().mockResolvedValue(res(404))
    await withRetry(send, { sleep })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('reports each retry so a slow page is explicable', async () => {
    const onRetry = vi.fn()
    const send = vi.fn()
      .mockResolvedValueOnce(res(429))
      .mockResolvedValueOnce(res(200))
    await withRetry(send, { sleep, onRetry })
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ status: 429, attempt: 1 }))
  })
})

describe('a slow failure is not a busy failure', () => {
  // Retrying 504 cost the SPARQL editor three full minutes on a query that
  // legitimately takes one: the default query is a whole-store scan that
  // ends in a gateway timeout at ~60s. Three attempts meant nothing at all
  // appeared inside the smoke test's 65s window.
  it('retries a gateway timeout that came back quickly', () => {
    expect(worthRetrying(504, 200)).toBe(true)
    expect(worthRetrying(502, 1000)).toBe(true)
  })

  it('does not retry a gateway timeout that took a minute', () => {
    expect(worthRetrying(504, 60_000)).toBe(false)
    expect(worthRetrying(502, SLOW_FAILURE_MS)).toBe(false)
  })

  it('still retries a rate limit however long the attempt took', () => {
    // A 429 arrives immediately and says nothing about how slow the work
    // is; the elapsed time is somebody else's queue, not ours.
    expect(worthRetrying(429, 60_000)).toBe(true)
    expect(worthRetrying(408, 60_000)).toBe(true)
  })

  it('withRetry stops after one slow gateway failure', async () => {
    let clock = 0
    const send = vi.fn(async () => { clock += 60_000; return res(504) })
    const out = await withRetry(send, {
      sleep: async () => {}, now: () => clock,
    })
    expect(out.status).toBe(504)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('withRetry keeps going when the gateway fails fast', async () => {
    let clock = 0
    const send = vi.fn()
      .mockImplementationOnce(async () => { clock += 100; return res(504) })
      .mockImplementationOnce(async () => { clock += 100; return res(200) })
    const out = await withRetry(send, { sleep: async () => {}, now: () => clock })
    expect(out.status).toBe(200)
    expect(send).toHaveBeenCalledTimes(2)
  })
})
