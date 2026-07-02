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
