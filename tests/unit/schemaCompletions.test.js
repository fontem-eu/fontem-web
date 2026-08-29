import { describe, it, expect } from 'vitest'
import { buildVocab, completionSource, sqlSchemaMap, KEYWORDS } from '../../src/composables/schemaCompletions.js'

describe('schemaCompletions', () => {
  it('cypher vocab = labels + rels + properties + keywords', () => {
    const v = buildVocab('cypher', { labels: ['Company'], relationshipTypes: ['AWARDED_TO'], properties: ['name', 'lei'] })
    const byType = (t) => v.filter((o) => o.type === t).map((o) => o.label)
    expect(byType('class')).toContain('Company')
    expect(byType('type')).toContain('AWARDED_TO')
    expect(byType('property')).toEqual(['name', 'lei'])
    expect(v.some((o) => o.type === 'keyword' && o.label === 'MATCH')).toBe(true)
  })

  it('sparql vocab shortens URIs to local names but applies the full IRI', () => {
    const v = buildVocab('sparql', { classes: ['https://schema.org/Organization'], predicates: ['http://www.w3.org/2000/01/rdf-schema#label'] })
    const org = v.find((o) => o.label === 'Organization')
    expect(org.type).toBe('class')
    expect(org.detail).toBe('https://schema.org/Organization')
    expect(org.apply).toBe('<https://schema.org/Organization>')
    expect(v.find((o) => o.label === 'label').type).toBe('property')
  })

  it('completionSource returns matched options for a typed prefix', () => {
    const src = completionSource('cypher', { labels: ['Company', 'Contract'], relationshipTypes: [], properties: [] })
    const ctx = { explicit: false, matchBefore: () => ({ from: 0, to: 4, text: 'Comp' }) }
    const res = src(ctx)
    expect(res.from).toBe(0)
    expect(res.options.some((o) => o.label === 'Company')).toBe(true)
  })

  it('completionSource returns null on an empty, non-explicit position', () => {
    const src = completionSource('cypher', {})
    expect(src({ explicit: false, matchBefore: () => ({ from: 3, to: 3, text: '' }) })).toBeNull()
  })

  it('sqlSchemaMap turns tables payload into a {table: [cols]} map for lang-sql', () => {
    const m = sqlSchemaMap({ tables: [{ name: 'observation', columns: [{ name: 'geo_code' }, { name: 'value' }] }] })
    expect(m).toEqual({ observation: ['geo_code', 'value'] })
  })

  it('read-only keyword sets omit write/DDL keywords', () => {
    expect(KEYWORDS.cypher).not.toContain('CREATE')
    expect(KEYWORDS.sparql).not.toContain('INSERT')
  })
})

// ── Mutation-hardening: pin the keyword sets and vocab shapes ──────
describe('KEYWORDS are exact', () => {
  const CYPHER = ['MATCH', 'OPTIONAL MATCH', 'WHERE', 'RETURN', 'WITH', 'ORDER BY', 'SKIP', 'LIMIT',
    'AS', 'AND', 'OR', 'NOT', 'IN', 'IS NULL', 'IS NOT NULL', 'DISTINCT', 'UNWIND',
    'CALL', 'YIELD', 'UNION', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'STARTS WITH',
    'ENDS WITH', 'CONTAINS', 'count', 'sum', 'avg', 'min', 'max', 'collect', 'size',
    'toInteger', 'toFloat', 'toLower', 'toUpper', 'coalesce', 'exists']
  const SPARQL = ['SELECT', 'DISTINCT', 'WHERE', 'PREFIX', 'FILTER', 'OPTIONAL', 'UNION', 'GRAPH',
    'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'BIND', 'VALUES', 'AS', 'ASC',
    'DESC', 'a', 'ASK', 'CONSTRUCT', 'DESCRIBE', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
    'STR', 'LANG', 'REGEX', 'BOUND', 'IF', 'CONCAT']

  it('cypher read-only keyword set', () => {
    expect(KEYWORDS.cypher).toEqual(CYPHER)
  })

  it('sparql read-only keyword set', () => {
    expect(KEYWORDS.sparql).toEqual(SPARQL)
  })

  it('sql keeps no keywords of its own (lang-sql provides them)', () => {
    expect(KEYWORDS.sql).toEqual([])
  })
})

describe('buildVocab shapes', () => {
  it('cypher merges labels, relationships, properties then keywords', () => {
    const vocab = buildVocab('cypher', {
      labels: ['Company'], relationshipTypes: ['AWARDED'], properties: ['name'],
    })
    expect(vocab[0]).toEqual({ label: 'Company', type: 'class', detail: 'node' })
    expect(vocab[1]).toEqual({ label: 'AWARDED', type: 'type', detail: 'relationship' })
    expect(vocab[2]).toEqual({ label: 'name', type: 'property' })
    expect(vocab[3]).toEqual({ label: 'MATCH', type: 'keyword' })
  })

  it('sparql derives local names and angle-bracket apply strings', () => {
    const vocab = buildVocab('sparql', {
      classes: ['http://ex.org/ont#Company'], predicates: ['http://ex.org/prop/paid'],
    })
    expect(vocab[0]).toEqual({
      label: 'Company', type: 'class',
      detail: 'http://ex.org/ont#Company', apply: '<http://ex.org/ont#Company>',
    })
    expect(vocab[1].label).toBe('paid')
    expect(vocab[1].type).toBe('property')
  })

  it('falls back to keywords only without a schema or for unknown langs', () => {
    expect(buildVocab('cypher', null).every((o) => o.type === 'keyword')).toBe(true)
    expect(buildVocab('nope', { labels: ['X'] }).length).toBe(0)
  })
})

describe('completionSource', () => {
  const src = completionSource('cypher', null)
  it('completes from the start of the identifier segment', () => {
    const ctx = { matchBefore: () => ({ from: 3, to: 7 }), explicit: false }
    const out = src(ctx)
    expect(out.from).toBe(3)
    expect(out.options.some((o) => o.label === 'MATCH')).toBe(true)
    expect(String(out.validFor)).toBe(String(/^\w*$/))
  })

  it('stays quiet on an empty match unless explicitly invoked', () => {
    expect(src({ matchBefore: () => null, explicit: true })).toBeNull()
    expect(src({ matchBefore: () => ({ from: 5, to: 5 }), explicit: false })).toBeNull()
    expect(src({ matchBefore: () => ({ from: 5, to: 5 }), explicit: true })).not.toBeNull()
  })
})

describe('sqlSchemaMap', () => {
  it('maps tables to column-name arrays', () => {
    expect(sqlSchemaMap({
      tables: [
        { name: 'contracts', columns: [{ name: 'id' }, { name: 'value' }] },
        { name: 'empty' },
      ],
    })).toEqual({ contracts: ['id', 'value'], empty: [] })
  })

  it('returns {} without a schema', () => {
    expect(sqlSchemaMap(null)).toEqual({})
    expect(sqlSchemaMap({})).toEqual({})
  })
})
