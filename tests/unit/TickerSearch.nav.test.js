/**
 * TickerSearch → results-page navigation: pressing Enter without a highlighted
 * autocomplete suggestion takes the user to /search?q=… (the core entry flow
 * into the dedicated results page).
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import * as tickersApi from '../../src/api/tickers.js'
import TickerSearch from '../../src/components/TickerSearch.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/search', component: { template: '<div/>' } },
    ],
  })
}

describe('TickerSearch navigation', () => {
  it('Enter with a query and no highlighted suggestion routes to /search', async () => {
    const router = makeRouter()
    await router.push('/')
    await router.isReady()
    const push = vi.spyOn(router, 'push')

    const w = mount(TickerSearch, { global: { plugins: [router] } })
    const input = w.find('input')
    await input.setValue('carbon lobbyists')
    await input.trigger('keydown', { key: 'Enter' })

    expect(push).toHaveBeenCalledWith({ path: '/search', query: { q: 'carbon lobbyists' } })
  })

  it('Enter with an empty query does not navigate', async () => {
    const router = makeRouter()
    await router.push('/')
    await router.isReady()
    const push = vi.spyOn(router, 'push')

    const w = mount(TickerSearch, { global: { plugins: [router] } })
    await w.find('input').trigger('keydown', { key: 'Enter' })
    expect(push).not.toHaveBeenCalled()
  })

  it('clicking the search button navigates to /search', async () => {
    const router = makeRouter()
    await router.push('/')
    await router.isReady()
    const push = vi.spyOn(router, 'push')
    const w = mount(TickerSearch, { global: { plugins: [router] } })
    await w.find('input').setValue('carbon')
    await w.find('[data-testid="ticker-search-btn"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ path: '/search', query: { q: 'carbon' } })
  })

  it('a search that was in-flight cannot repopulate the dropdown after navigating', async () => {
    vi.useFakeTimers()
    let resolveSearch
    vi.spyOn(tickersApi, 'searchAll').mockReturnValue(
      new Promise((res) => { resolveSearch = res }),
    )
    const router = makeRouter()
    await router.push('/')
    await router.isReady()
    const w = mount(TickerSearch, { global: { plugins: [router] } })
    await w.find('input').setValue('apple')
    await vi.advanceTimersByTimeAsync(300) // fire the debounced (in-flight) search
    // navigate away via the search button before the request resolves
    await w.find('[data-testid="ticker-search-btn"]').trigger('click')
    // the stale request now resolves — it must NOT repopulate the dropdown
    resolveSearch({ companies: [{ name: 'Apple Inc.', ticker: 'AAPL' }], authorities: [], persons: [] })
    await flushPromises()
    expect(w.find('.gmr-results').exists()).toBe(false)
    vi.useRealTimers()
  })
})
