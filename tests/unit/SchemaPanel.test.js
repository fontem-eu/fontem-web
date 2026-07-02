import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const loadSchema = vi.fn()
const cache = {}
vi.mock('../../src/composables/useQuerySchema.js', () => ({ useQuerySchema: () => ({ loadSchema, cache }) }))
import SchemaPanel from '../../src/components/SchemaPanel.vue'

describe('SchemaPanel', () => {
  beforeEach(() => { loadSchema.mockReset().mockResolvedValue(null); for (const k of Object.keys(cache)) delete cache[k] })

  it('lists cypher labels + relationships and expands a label to its properties', async () => {
    cache.cypher = { labels: ['Company'], relationshipTypes: ['AWARDED_TO'], properties: ['name'], labelProperties: { Company: ['name', 'lei'] } }
    const w = mount(SchemaPanel, { props: { lang: 'cypher' } }); await flushPromises()
    expect(w.find('[data-testid="schema-label"]').text()).toContain('Company')
    expect(w.find('[data-testid="schema-rel"]').text()).toContain('AWARDED_TO')
    await w.find('[data-testid="schema-label"] .term').trigger('click')
    expect(w.find('[data-testid="schema-label"]').text()).toContain('lei')
  })

  it('lists sql tables and sparql predicates by local name', async () => {
    cache.sql = { tables: [{ name: 'observation', columns: [{ name: 'value', type: 'numeric' }] }] }
    const w = mount(SchemaPanel, { props: { lang: 'sql' } }); await flushPromises()
    expect(w.find('[data-testid="schema-table"]').text()).toContain('observation')
    cache.sparql = { classes: ['https://schema.org/Organization'], predicates: ['http://x/y#label'] }
    const w2 = mount(SchemaPanel, { props: { lang: 'sparql' } }); await flushPromises()
    expect(w2.find('[data-testid="schema-class"]').text()).toBe('Organization')
    expect(w2.find('[data-testid="schema-pred"]').text()).toBe('label')
  })
})
