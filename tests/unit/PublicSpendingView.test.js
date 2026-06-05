/**
 * Public Spending — search + country-scoped recommendation panels.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/euroTracker.js', () => ({
  fetchMyCountry: vi.fn(),
  fetchRecommendations: vi.fn(),
}))

import * as api from '../../src/api/euroTracker.js'
import PublicSpendingView from '../../src/views/PublicSpendingView.vue'

// TickerSearch is heavy; stub it so the test only verifies the
// hosting + the wired select handler.
const TickerSearchStub = {
  name: 'TickerSearch',
  template: '<div data-testid="ticker-search-stub" />',
  props: ['selectedSymbol', 'compact'],
  emits: ['select'],
}
const WordmarkStub = { template: '<div />' }

async function mountAt(path = '/public-spending') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/public-spending', component: PublicSpendingView },
      { path: '/c/:symbol/:view', component: { template: '<div />' } },
      { path: '/authority/:id', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(PublicSpendingView, {
    global: {
      plugins: [router, makeTestI18n()],
      stubs: { TickerSearch: TickerSearchStub, Wordmark: WordmarkStub },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: country detected, recommendations return data.
  api.fetchMyCountry.mockResolvedValue({ country: 'PRT', source: 'geoip' })
  api.fetchRecommendations.mockResolvedValue({
    country: 'PRT',
    companies: [
      { id: 'c1', name: 'Foo Lda',  total_value_eur: 1.0e6, contract_count:  5 },
      { id: 'c2', name: 'Bar SA',   total_value_eur: 5.0e5, contract_count:  3 },
    ],
    authorities: [
      { id: 'a1', name: 'Município X', total_value_eur: 8.0e6, contract_count: 240 },
    ],
  })
})
afterEach(() => vi.restoreAllMocks())

describe('PublicSpendingView', () => {
  it('renders the search card', async () => {
    const { wrapper } = await mountAt()
    expect(wrapper.find('[data-testid="ps-search"]').exists()).toBe(true)
  })

  it('detects country on mount and fetches recommendations', async () => {
    const { wrapper } = await mountAt()
    expect(api.fetchMyCountry).toHaveBeenCalled()
    expect(api.fetchRecommendations).toHaveBeenCalledWith('PRT', { limit: 10 })
    // Both panels render with data.
    expect(wrapper.find('[data-testid="ps-company-c1"]').text()).toContain('Foo Lda')
    expect(wrapper.find('[data-testid="ps-authority-a1"]').text()).toContain('Município X')
  })

  it('falls back to country picker when GeoIP returns null', async () => {
    api.fetchMyCountry.mockResolvedValueOnce({ country: null, source: 'unknown' })
    const { wrapper } = await mountAt()
    expect(api.fetchRecommendations).not.toHaveBeenCalled()
    // Picker is the affordance; panels stay hidden until a country is chosen.
    expect(wrapper.find('[data-testid="ps-country-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ps-panels"]').exists()).toBe(false)
  })

  it('refetches when the country picker changes', async () => {
    const { wrapper } = await mountAt()
    await wrapper.find('[data-testid="ps-country-select"]').setValue('DEU')
    await flushPromises()
    // First call was the GeoIP-detected PRT, second is the picker DEU.
    const lastCall = api.fetchRecommendations.mock.calls.at(-1)
    expect(lastCall).toEqual(['DEU', { limit: 10 }])
  })

  it('navigates to the company profile on row click', async () => {
    const { wrapper, router } = await mountAt()
    const pushSpy = vi.spyOn(router, 'push')
    await wrapper.find('[data-testid="ps-company-c1"]').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/c/c1/profile')
  })

  it('forwards a TickerSearch select to /c/:symbol/:view', async () => {
    const { wrapper, router } = await mountAt()
    const pushSpy = vi.spyOn(router, 'push')
    await wrapper.findComponent({ name: 'TickerSearch' }).vm.$emit('select', 'ASML.AS')
    expect(pushSpy).toHaveBeenCalledWith('/c/ASML.AS/summary')
  })

  it('treats a UUID symbol as a profile-route navigation', async () => {
    const { wrapper, router } = await mountAt()
    const pushSpy = vi.spyOn(router, 'push')
    const uuid = 'a73f2b1c-2fca-5ad8-a0ad-8b86d24b5371'
    await wrapper.findComponent({ name: 'TickerSearch' }).vm.$emit('select', uuid)
    expect(pushSpy).toHaveBeenCalledWith(`/c/${uuid}/profile`)
  })

  it('surfaces an error when the recommendations call fails', async () => {
    api.fetchRecommendations.mockRejectedValueOnce(new Error('boom'))
    const { wrapper } = await mountAt()
    expect(wrapper.find('[data-testid="ps-error"]').text()).toContain('boom')
  })
})
