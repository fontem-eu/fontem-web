/**
 * TickerSearch → results-page navigation: pressing Enter without a highlighted
 * autocomplete suggestion takes the user to /search?q=… (the core entry flow
 * into the dedicated results page).
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
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
})
