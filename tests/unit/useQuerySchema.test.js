import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useQuerySchema } from '../../src/composables/useQuerySchema.js'

describe('useQuerySchema', () => {
  beforeEach(() => { global.fetch = vi.fn() })

  it('fetches a schema once and caches it', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ labels: ['Company'] }) })
    const { loadSchema, cache } = useQuerySchema()
    const s = await loadSchema('cypher')
    expect(global.fetch).toHaveBeenCalledWith('/api/query/schema/cypher')
    expect(s.labels).toEqual(['Company'])
    await loadSchema('cypher')
    expect(global.fetch).toHaveBeenCalledTimes(1) // cached
    expect(cache.cypher.labels).toEqual(['Company'])
  })

  it('caches null on error (no throw)', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 503 })
    const { loadSchema } = useQuerySchema()
    expect(await loadSchema('sql')).toBeNull()
  })

  // Autocomplete is optional: a schema that cannot be fetched at all means
  // no autocomplete, never an unhandled rejection from the editor.
  it('is no schema, not an error, when the request cannot even be made', async () => {
    global.fetch.mockImplementation(() => { throw new TypeError('Failed to fetch') })
    await expect(useQuerySchema().loadSchema('cypher-throws')).resolves.toBeNull()
  })

  it('is no schema, not an error, when fetch answers with nothing', async () => {
    await expect(useQuerySchema().loadSchema('cypher-nothing')).resolves.toBeNull()
  })
})
