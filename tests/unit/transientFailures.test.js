import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The three e2e failures, reproduced at the level where they actually
// happen. Each one is a single transient status that the client turned
// into a permanent, silent failure.

describe('the Studio query runner', () => {
  let fetchMock
  beforeEach(() => {
    vi.resetModules()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.unstubAllGlobals())

  const ok = (body) => ({ ok: true, status: 200, json: async () => body,
    headers: { get: () => null } })
  const rateLimited = () => ({ ok: false, status: 429,
    json: async () => ({ detail: 'Too Many Requests' }),
    headers: { get: () => null } })

  it('survives one 429 — SPARQL-EDITOR', async () => {
    // Verbatim the gate failure: "Query failed: HTTP 429", permanent.
    const { runSource } = await import('../../src/composables/studioEngines.js')
    // SPARQL answers in the SPARQL 1.1 JSON shape, not {columns, rows} —
    // runSource normalises it, so the fixture has to be the real thing.
    fetchMock.mockResolvedValueOnce(rateLimited())
      .mockResolvedValueOnce(ok({
        head: { vars: ['s'] },
        results: { bindings: [{ s: { value: 'x' } }] },
      }))
    const out = await runSource('sparql', 'SELECT ?s WHERE { ?s ?p ?o }')
    expect(out.columns).toEqual(['s'])
    expect(out.rows).toEqual([['x']])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('still fails loudly when the limit does not lift', async () => {
    const { runSource } = await import('../../src/composables/studioEngines.js')
    fetchMock.mockResolvedValue(rateLimited())
    await expect(runSource('cypher', 'MATCH (n) RETURN n')).rejects.toThrow(/Too Many Requests|429/)
  })

  it('carries the status on the error so callers can say which failure it was', async () => {
    const { runSource } = await import('../../src/composables/studioEngines.js')
    fetchMock.mockResolvedValue(rateLimited())
    const err = await runSource('sql', 'SELECT 1').catch((e) => e)
    expect(err.status).toBe(429)
  })

  it('does not retry a query the engine rejected', async () => {
    // A syntax error is not going to fix itself, and retrying it wastes
    // the user's time and the engine's.
    const { runSource } = await import('../../src/composables/studioEngines.js')
    fetchMock.mockResolvedValue({ ok: false, status: 400,
      json: async () => ({ detail: "Invalid input 'MTCH'" }),
      headers: { get: () => null } })
    await expect(runSource('cypher', 'MTCH (n) RETURN n')).rejects.toThrow(/MTCH/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('says out loud that it retried', async () => {
    const { runSource } = await import('../../src/composables/studioEngines.js')
    fetchMock.mockResolvedValueOnce(rateLimited())
      .mockResolvedValueOnce(ok({ columns: [], rows: [] }))
    await runSource('sql', 'SELECT 1')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('429'))
  })
})

describe('the community API client', () => {
  let fetchMock
  beforeEach(() => {
    vi.resetModules()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.doMock('../../src/api/session.js', () => ({
      getAccessToken: () => 'tok',
      refresh: vi.fn(),
      whenSessionReady: async () => {},
    }))
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock('../../src/api/session.js') })

  const json = (status, body, headers = {}) => ({
    ok: status < 400, status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  })

  it('retries a rate-limited GET — the TRANS-01 failure', async () => {
    // getTranslation is a GET; one 429 left switchLanguage throwing, which
    // left the English title under a Portuguese picker.
    const { getTranslation } = await import('../../src/api/community.js')
    fetchMock.mockResolvedValueOnce(json(429, { detail: 'slow down' }))
      .mockResolvedValueOnce(json(200, { lang: 'pt', title: 'Título' }))
    const out = await getTranslation('story-1', 'pt')
    expect(out.title).toBe('Título')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry a rate-limited POST', async () => {
    // A retried create makes a second story. No rate limit is worth that.
    const { createReport } = await import('../../src/api/community.js')
    fetchMock.mockResolvedValue(json(429, { detail: 'slow down' }))
    await expect(createReport('t', 'a')).rejects.toThrow(/429/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('puts the status on the error', async () => {
    const { getReport } = await import('../../src/api/community.js')
    fetchMock.mockResolvedValue(json(429, { detail: 'slow down' }))
    const err = await getReport('x').catch((e) => e)
    expect(err.status).toBe(429)
    expect(err.path).toContain('/data-stories/x')
  })

  it('honours Retry-After on a GET', async () => {
    const { getReport } = await import('../../src/api/community.js')
    fetchMock.mockResolvedValueOnce(json(429, {}, { 'retry-after': '0' }))
      .mockResolvedValueOnce(json(200, { id: 'x' }))
    expect((await getReport('x')).id).toBe('x')
  })

  it('still retries a bad gateway on GET, as it always did', async () => {
    const { getReport } = await import('../../src/api/community.js')
    fetchMock.mockResolvedValueOnce(json(502, {}))
      .mockResolvedValueOnce(json(200, { id: 'x' }))
    expect((await getReport('x')).id).toBe('x')
  })
})
