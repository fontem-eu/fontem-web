/**
 * SearchView — the unified /search results page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

const searchGraph = vi.fn()
const searchStories = vi.fn()
const fetchBoundaries = vi.fn()

vi.mock('../../src/api/search.js', () => ({
  searchGraph: (...a) => searchGraph(...a),
  searchStories: (...a) => searchStories(...a),
}))
vi.mock('../../src/api/geo.js', () => ({
  fetchBoundaries: (...a) => fetchBoundaries(...a),
}))

import SearchView from '../../src/views/SearchView.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/search', component: SearchView },
      { path: '/company/:gmr_id', component: { template: '<div/>' } },
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
  fetchBoundaries.mockReset()
  fetchBoundaries.mockResolvedValue({ features: [] })
  searchGraph.mockResolvedValue({
    results: [
      { type: 'company', id: 'c1', title: 'Apple Inc.', subtitle: 'AAPL', country: 'USA', date: null, score: 3 },
      { type: 'contract', id: 't1', title: 'Apple procurement', subtitle: 'PRT', country: 'PRT', date: '2022-05-01', score: 0 },
    ],
    counts: { company: 1, contract: 1, authority: 0, person: 0, lobbyist: 0, cohesion: 0, sanction: 0 },
    has_more: false,
  })
  searchStories.mockResolvedValue([
    { id: 's1', title: 'Apple story', abstract: 'about apples', created_at: '2023-01-01' },
  ])
})

describe('SearchView', () => {
  it('fetches both backends for the query and renders typed results', async () => {
    const { w } = await mountAt({ q: 'apple' })
    expect(searchGraph).toHaveBeenCalledWith(expect.objectContaining({ q: 'apple' }))
    expect(searchStories).toHaveBeenCalledWith(expect.objectContaining({ q: 'apple' }))
    const text = w.text()
    expect(text).toContain('Apple Inc.')       // graph company
    expect(text).toContain('Apple procurement') // graph contract
    expect(text).toContain('Apple story')       // data story (community)
    // story is normalised into the unified list and appears first
    expect(w.find('[data-testid="result-story"]').exists()).toBe(true)
    expect(w.find('[data-testid="result-company"]').exists()).toBe(true)
  })

  it('links company + story results to their detail routes; leaves contracts too', async () => {
    const { w } = await mountAt({ q: 'apple' })
    const links = w.findAll('a.result-title').map((a) => a.attributes('href'))
    expect(links.some((h) => h.includes('/company/c1'))).toBe(true)
    expect(links.some((h) => h.includes('/stories/s1'))).toBe(true)
  })

  it('toggling a type facet updates the URL query', async () => {
    const { w, router } = await mountAt({ q: 'apple' })
    await w.find('[data-testid="facet-company"]').trigger('change')
    await flushPromises()
    // company deselected → types query excludes it
    expect(router.currentRoute.value.query.types).toBeDefined()
    expect(router.currentRoute.value.query.types).not.toContain('company')
  })

  it('opens the advanced drawer and shows region + date filters', async () => {
    const { w } = await mountAt({ q: 'apple' })
    expect(w.find('[data-testid="advanced-drawer"]').exists()).toBe(false)
    await w.find('[data-testid="advanced-toggle"]').trigger('click')
    expect(w.find('[data-testid="advanced-drawer"]').exists()).toBe(true)
    expect(w.find('[data-testid="adv-region"]').exists()).toBe(true)
    expect(w.find('[data-testid="adv-date-from"]').exists()).toBe(true)
  })

  it('a region filter suppresses the story backend (stories have no geography)', async () => {
    await mountAt({ q: 'apple', nuts: 'PT' })
    expect(searchGraph).toHaveBeenCalledWith(expect.objectContaining({ nuts: 'PT' }))
    expect(searchStories).not.toHaveBeenCalled()
  })

  it('shows an empty state when nothing matches', async () => {
    searchGraph.mockResolvedValue({ results: [], counts: {}, has_more: false })
    searchStories.mockResolvedValue([])
    const { w } = await mountAt({ q: 'zzz' })
    expect(w.find('[data-testid="search-empty"]').exists()).toBe(true)
  })
})
