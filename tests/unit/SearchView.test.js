/**
 * SearchView — the unified /search results page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

const searchGraph = vi.fn()
const searchStories = vi.fn()
const fetchNutsRegions = vi.fn()

vi.mock('../../src/api/search.js', () => ({
  searchGraph: (...a) => searchGraph(...a),
  searchStories: (...a) => searchStories(...a),
}))
vi.mock('../../src/api/geo.js', () => ({
  fetchNutsRegions: (...a) => fetchNutsRegions(...a),
}))

import SearchView from '../../src/views/SearchView.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/search', component: SearchView },
      { path: '/company/:gmr_id/:view?', component: { template: '<div/>' } },
      { path: '/authority/:authority_id/:view?', component: { template: '<div/>' } },
      { path: '/contract/:noticeId', component: { template: '<div/>' } },
      { path: '/c/:ticker/:view', component: { template: '<div/>' } },
      { path: '/stories/:id', component: { template: '<div/>' } },
    ],
  })
}

async function mountAt(query) {
  const router = makeRouter()
  router.push({ path: '/search', query })
  await router.isReady()
  const w = mount(SearchView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return { w, router }
}

beforeEach(() => {
  searchGraph.mockReset()
  searchStories.mockReset()
  fetchNutsRegions.mockReset()
  fetchNutsRegions.mockResolvedValue({
    regions: [
      { code: 'PT', name: 'Portugal', level: 0 },
      { code: 'DE', name: 'Germany', level: 0 },
      { code: 'PT1', name: 'Continente', level: 1 },
      { code: 'PT17', name: 'Área Metropolitana de Lisboa', level: 2 },
      { code: 'PT170', name: 'Grande Lisboa', level: 3 },
    ],
  })
  searchGraph.mockResolvedValue({
    results: [
      { type: 'company', id: 'c1', title: 'Apple Inc.', subtitle: 'AAPL', context: 'Cupertino · Inc.', country: 'USA', date: null, score: 3, meta: {} },
      { type: 'contract', id: 't1', title: 'Apple procurement', subtitle: 'PRT', context: '', country: 'PRT', date: '2022-05-01', score: 0, meta: { value_eur: 1200000 } },
    ],
    counts: { company: 1, contract: 1, authority: 0, person: 0, lobbyist: 0, cohesion: 0, sanction: 0 },
    has_more: false,
  })
  searchStories.mockResolvedValue([
    { id: 's1', title: 'Apple story', abstract: 'about apples', created_at: '2023-01-01' },
  ])
})

describe('SearchView', () => {
  it('fetches both backends and renders typed results', async () => {
    const { w } = await mountAt({ q: 'apple' })
    expect(searchGraph).toHaveBeenCalledWith(expect.objectContaining({ q: 'apple' }))
    expect(searchStories).toHaveBeenCalledWith(expect.objectContaining({ q: 'apple' }))
    const text = w.text()
    expect(text).toContain('Apple Inc.')
    expect(text).toContain('Apple procurement')
    expect(text).toContain('Apple story')
  })

  it('renders contextual info on cards (backend context + formatted contract value)', async () => {
    const { w } = await mountAt({ q: 'apple' })
    const contexts = w.findAll('[data-testid="result-context"]').map((n) => n.text())
    expect(contexts).toContain('Cupertino · Inc.')              // company context
    expect(contexts.some((c) => /€.*1\.2M|1\.2M/.test(c))).toBe(true)  // formatted contract value
  })

  it('makes the whole card link to the detail route (company, contract, story)', async () => {
    const { w } = await mountAt({ q: 'apple' })
    const links = w.findAll('a.result-card').map((a) => a.attributes('href'))
    expect(links.some((h) => h.includes('/company/c1'))).toBe(true)
    expect(links.some((h) => h.includes('/contract/t1'))).toBe(true)
    expect(links.some((h) => h.includes('/stories/s1'))).toBe(true)
    // clickable cards carry the affordance class
    expect(w.findAll('.result-card--link').length).toBeGreaterThanOrEqual(3)
  })

  it('links authorities to their entity page and cohesion to the beneficiary company', async () => {
    searchGraph.mockResolvedValue({
      results: [
        { type: 'authority', id: 'auth-9', title: 'Ministério das Finanças', subtitle: '', context: '', country: 'PRT', date: null, score: 0, meta: {} },
        { type: 'cohesion', id: 'proj-1', title: 'Bridge project', subtitle: '', context: '', country: 'CZE', date: null, score: 0, meta: { company_gmr_id: 'gmr-benef-1' } },
      ],
      counts: { authority: 1, cohesion: 1 },
      has_more: false,
    })
    searchStories.mockResolvedValue([])
    const { w } = await mountAt({ q: 'x' })
    const links = w.findAll('a.result-card').map((a) => a.attributes('href'))
    // The semantic entity URL, which renders the same full page /c/:id
    // does — profile, procurement, graph. It used to be the ticker-shaped
    // URL; both work, this one is the canonical one the sitemap uses.
    expect(links.some((h) => h.includes('/authority/auth-9'))).toBe(true)
    expect(links.some((h) => h.includes('/company/gmr-benef-1'))).toBe(true)
  })

  it('links a lobbyist card out to its declared website (scheme prepended), non-clickable when absent', async () => {
    searchGraph.mockResolvedValue({
      results: [
        { type: 'lobbyist', id: 'lob-1', title: 'Electrica lobby', subtitle: '', context: '', country: 'ROU', date: null, score: 0, meta: { url: 'www.electrica.ro' } },
        { type: 'person', id: 'p-1', title: 'Jane Director', subtitle: '', context: '', country: null, date: null, score: 0, meta: {} },
      ],
      counts: { lobbyist: 1, person: 1 },
      has_more: false,
    })
    searchStories.mockResolvedValue([])
    const { w } = await mountAt({ q: 'x' })
    const ext = w.find('[data-testid="result-external-link"]')
    expect(ext.attributes('href')).toBe('https://www.electrica.ro')
    expect(ext.attributes('target')).toBe('_blank')
    expect(ext.attributes('rel')).toContain('noopener')
    // a person has no destination → plain div, not a link
    const person = w.find('[data-testid="result-person"] .result-card')
    expect(person.element.tagName).toBe('DIV')
    expect(person.classes()).not.toContain('result-card--link')
  })

  it('entity-type facets live inside the advanced drawer (hidden by default)', async () => {
    const { w } = await mountAt({ q: 'apple' })
    // facets not visible until advanced is opened
    expect(w.find('[data-testid="facet-company"]').exists()).toBe(false)
    await w.find('[data-testid="advanced-toggle"]').trigger('click')
    expect(w.find('[data-testid="facet-company"]').exists()).toBe(true)
  })

  it('toggling a type facet updates the URL query', async () => {
    const { w, router } = await mountAt({ q: 'apple' })
    await w.find('[data-testid="advanced-toggle"]').trigger('click')
    await w.find('[data-testid="facet-company"]').trigger('change')
    await flushPromises()
    expect(router.currentRoute.value.query.types).toBeDefined()
    expect(router.currentRoute.value.query.types).not.toContain('company')
  })

  it('picking a region in the cascade updates the URL query', async () => {
    const { w, router } = await mountAt({ q: 'apple' })
    await w.find('[data-testid="advanced-toggle"]').trigger('click')
    await flushPromises()
    await w.find('[data-testid="nuts-l0"]').setValue('PT')
    await flushPromises()
    expect(router.currentRoute.value.query.nuts).toBe('PT')
  })

  it('reconstructs the cascade from a nuts code in the URL and filters by it', async () => {
    await mountAt({ q: 'apple', nuts: 'PT17' })
    expect(searchGraph).toHaveBeenCalledWith(expect.objectContaining({ nuts: 'PT17' }))
    // region filter suppresses the (geography-less) story backend
    expect(searchStories).not.toHaveBeenCalled()
  })

  it('shows an empty state when nothing matches', async () => {
    searchGraph.mockResolvedValue({ results: [], counts: {}, has_more: false })
    searchStories.mockResolvedValue([])
    const { w } = await mountAt({ q: 'zzz' })
    expect(w.find('[data-testid="search-empty"]').exists()).toBe(true)
  })
})

describe('SearchView — legislation results', () => {
  it('renders a legislation card with an external EUR-Lex link', async () => {
    searchGraph.mockResolvedValue({
      results: [
        {
          type: 'legislation', id: '32024L1385',
          title: 'Directive (EU) 2024/1385 on combating violence against women',
          subtitle: '32024L1385', context: 'Directive', country: null,
          date: '2024-05-14', score: 0,
          meta: { celex: '32024L1385', eurlex_url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024L1385' },
        },
      ],
      counts: { legislation: 1 },
      has_more: false,
    })
    const { w } = await mountAt({ q: 'violence women', types: 'legislation' })
    const ext = w.find('[data-testid="result-external-link"]')
    expect(ext.exists()).toBe(true)
    expect(ext.attributes('href')).toContain('CELEX:32024L1385')
    expect(ext.attributes('target')).toBe('_blank')
    expect(ext.attributes('rel')).toContain('noopener')
    expect(w.text()).toContain('Directive (EU) 2024/1385')
  })

  it('requests the legislation type from the graph backend', async () => {
    await mountAt({ q: 'violence' })
    const arg = searchGraph.mock.calls[0][0]
    expect(arg.types).toContain('legislation')
  })

  it('legislation facet checkbox is present in the advanced drawer', async () => {
    const { w } = await mountAt({ q: 'violence' })
    await w.find('[data-testid="advanced-toggle"]').trigger('click')
    expect(w.find('[data-testid="facet-legislation"]').exists()).toBe(true)
  })
})

// ── search results reach the full entity page ────────────────────────
//
// The regression this covers: company results linked to a thin
// standalone view that showed contracts and cohesion grants and nothing
// else, so the page with financials, the corporate group, directors and
// the graph was unreachable from search. Authorities went to the
// ticker-shaped URL for the same page. Both now use the semantic entity
// URL, which renders that full page.
describe('SearchView — entity results reach the full profile', () => {
  it('sends a company to its entity page, not a thin one-off view', async () => {
    searchGraph.mockResolvedValue({
      results: [
        { type: 'company', id: 'gmr-1', title: 'Acme SA', subtitle: '', context: '', country: 'PRT', date: null, score: 0, meta: {} },
      ],
      counts: { company: 1 },
      has_more: false,
    })
    searchStories.mockResolvedValue([])
    const { w } = await mountAt({ q: 'acme' })
    const href = w.findAll('a.result-card').map((a) => a.attributes('href'))
    expect(href.some((h) => h.includes('/company/gmr-1'))).toBe(true)
  })

  it('sends companies and authorities to the same kind of page', async () => {
    // They are both entities; a reader clicking either is asking the
    // same question, and the answer lives on one page.
    searchGraph.mockResolvedValue({
      results: [
        { type: 'company', id: 'gmr-1', title: 'Acme SA', subtitle: '', context: '', country: 'PRT', date: null, score: 0, meta: {} },
        { type: 'authority', id: 'auth-1', title: 'Câmara Municipal', subtitle: '', context: '', country: 'PRT', date: null, score: 0, meta: {} },
      ],
      counts: { company: 1, authority: 1 },
      has_more: false,
    })
    searchStories.mockResolvedValue([])
    const { w } = await mountAt({ q: 'x' })
    const href = w.findAll('a.result-card').map((a) => a.attributes('href'))
    expect(href.some((h) => h.includes('/company/gmr-1'))).toBe(true)
    expect(href.some((h) => h.includes('/authority/auth-1'))).toBe(true)
    // Neither falls back to a non-clickable card.
    expect(w.findAll('a.result-card')).toHaveLength(2)
  })
})
