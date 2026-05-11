/**
 * TriplesDQView — RDF triple-store inventory page.
 *
 * Renders the /api/data-quality/triples payload: a top-level
 * total + named-graph counts + class/predicate breakdown for the
 * currently-selected graph. Default selection is the largest
 * graph (first in the API's sorted list) so the page shows real
 * content on first paint.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

import TriplesDQView from '../../src/views/dq/TriplesDQView.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/data-quality', component: { template: '<div />' } },
      { path: '/data-quality/triples', component: TriplesDQView },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  await router.push('/data-quality/triples')
  await router.isReady()
  const wrapper = mount(TriplesDQView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

const SAMPLE = {
  available: true,
  total_triples: 1234,
  graphs: [
    {
      iri: 'http://data.fontem.eu/graph/sanctions',
      label: 'sanctions',
      triples: 900,
      top_predicates: [
        { predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', n: 100 },
        { predicate: 'http://data.fontem.eu/ontology#regime', n: 50 },
      ],
      classes: [
        { class: 'http://data.fontem.eu/ontology#SanctionedEntity', n: 80 },
      ],
    },
    {
      iri: 'http://data.fontem.eu/graph/filings',
      label: 'filings',
      triples: 334,
      top_predicates: [
        { predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', n: 30 },
      ],
      classes: [
        { class: 'http://data.fontem.eu/ontology#Filing', n: 30 },
      ],
    },
  ],
  generated_at: '2026-05-11T20:00:00Z',
}

describe('TriplesDQView', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => jsonResponse(SAMPLE))
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders the top-level totals and graph count', async () => {
    const w = await mountView()
    expect(w.get('[data-testid="triples-total"]').text()).toContain('1,234')
    expect(w.get('[data-testid="triples-graph-count"]').text()).toContain('2')
  })

  it('lists graphs in the order returned by the API', async () => {
    const w = await mountView()
    const labels = w.findAll('.graph-row-label').map((el) => el.text())
    expect(labels).toEqual(['sanctions', 'filings'])
  })

  it('defaults to the first/largest graph for the detail panel', async () => {
    const w = await mountView()
    const detail = w.get('[data-testid="triples-graph-detail"]')
    // The detail header echoes the selected graph's IRI suffix.
    expect(detail.text()).toContain('sanctions')
    expect(detail.text()).toContain('http://data.fontem.eu/graph/sanctions')
  })

  it('switches the detail panel when a different graph row is clicked', async () => {
    const w = await mountView()
    await w.get('[data-testid="triples-graph-row-filings"]').trigger('click')
    await flushPromises()
    const detail = w.get('[data-testid="triples-graph-detail"]')
    expect(detail.text()).toContain('filings')
    expect(detail.text()).toContain('http://data.fontem.eu/graph/filings')
  })

  it('shows an "unconfigured" message when the API reports no virtuoso', async () => {
    global.fetch = vi.fn(() => jsonResponse({
      available: false, total_triples: 0, graphs: [], generated_at: null,
    }))
    const w = await mountView()
    expect(w.find('[data-testid="triples-dq-unconfigured"]').exists()).toBe(true)
    expect(w.find('[data-testid="triples-total"]').exists()).toBe(false)
  })

  it('shows an error block when the API returns 5xx', async () => {
    global.fetch = vi.fn(() => jsonResponse({}, 500))
    const w = await mountView()
    expect(w.find('[data-testid="triples-dq-error"]').exists()).toBe(true)
  })
})
