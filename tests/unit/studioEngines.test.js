/**
 * Query-engine metadata + the single-source runner.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ENGINES, engine, runSource } from '../../src/composables/studioEngines.js'

describe('ENGINES metadata', () => {
  it('pins the three engines with their proxy paths', () => {
    expect(ENGINES.map((e) => [e.key, e.label, e.store, e.path])).toEqual([
      ['cypher', 'Cypher', 'Neo4j graph', '/api/query/cypher'],
      ['sql', 'SQL', 'stats / Eurostat', '/api/query/sql'],
      ['sparql', 'SPARQL', 'Virtuoso RDF', '/api/sparql'],
    ])
  })

  it('ships a runnable-looking sample per engine', () => {
    expect(engine('cypher').sample).toContain('MATCH (c:Company)')
    expect(engine('sql').sample).toContain('FROM observation o')
    expect(engine('sparql').sample).toContain('PREFIX f: <http://data.fontem.eu/ontology#>')
  })

  it('engine() falls back to the first engine for unknown langs', () => {
    expect(engine('cypher').key).toBe('cypher')
    expect(engine('sparql').key).toBe('sparql')
    expect(engine('nope').key).toBe('cypher')
    expect(engine(undefined).key).toBe('cypher')
  })
})

describe('runSource', () => {
  const originalFetch = globalThis.fetch
  beforeEach(() => { globalThis.fetch = vi.fn() })
  afterEach(() => { globalThis.fetch = originalFetch })

  it('POSTs the query to the engine path and returns the table', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true, json: async () => ({ columns: ['a'], rows: [[1]] }),
    })
    await expect(runSource('sql', 'SELECT 1')).resolves.toEqual({ columns: ['a'], rows: [[1]] })
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('/api/query/sql')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ query: 'SELECT 1' })
  })

  it('normalizes SPARQL bindings into the same table shape', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        head: { vars: ['name', 'total'] },
        results: { bindings: [
          { name: { value: 'ACME' }, total: { value: '5' } },
          { name: { value: 'Umbrella' } },
        ] },
      }),
    })
    await expect(runSource('sparql', 'SELECT ...')).resolves.toEqual({
      columns: ['name', 'total'],
      rows: [['ACME', '5'], ['Umbrella', null]],
    })
    expect(globalThis.fetch.mock.calls[0][0]).toBe('/api/sparql')
  })

  it('surfaces the server detail with the status attached', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false, status: 400, json: async () => ({ detail: 'syntax error near LIMIT' }),
    })
    const err = await runSource('cypher', 'MATCH').catch((e) => e)
    expect(err.message).toBe('syntax error near LIMIT')
    expect(err.status).toBe(400)
  })

  it('falls back to HTTP <status> when the error body is unreadable', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false, status: 502, json: async () => { throw new Error('not json') },
    })
    await expect(runSource('sql', 'x')).rejects.toThrow('HTTP 502')
  })

  it('tolerates an empty success payload', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await expect(runSource('sql', 'x')).resolves.toEqual({ columns: [], rows: [] })
  })
})
