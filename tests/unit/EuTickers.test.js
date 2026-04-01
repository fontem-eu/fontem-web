/**
 * Unit tests for European (ESEF) ticker support.
 *
 * Covers:
 *  - TickerCard: emits full ticker (ASML.AS) for EU entries, shows ESEF badge
 *  - TickerSearch: keyboard nav emits full ticker for EU entries
 *  - HomeView: EU ticker hides Summary tab, redirects summary → fundamentals
 *  - TickerFinancials: shows ESEF badge in header for EU tickers
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'

import TickerCard from '../../src/components/TickerCard.vue'
import TickerSearch from '../../src/components/TickerSearch.vue'
import TickerFinancials from '../../src/components/TickerFinancials.vue'
import HomeView from '../../src/views/HomeView.vue'
import * as tickersApi from '../../src/api/tickers.js'
import * as gmrApi from '../../src/api/gmr.js'

// ── Fixtures ──────────────────────────────────────────────────

function makeEsefTicker(overrides = {}) {
  return {
    symbol: 'ASML',
    name: 'ASML Holding N.V.',
    ticker: 'ASML.AS',
    exchange: 'AS',
    country: 'NL',
    data_source: 'esef',
    ...overrides,
  }
}

function makeEdgarTicker(overrides = {}) {
  return {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    country: 'US',
    sector: 'Unknown',
    is_active: true,
    ...overrides,
  }
}

const ESEF_FUNDAMENTALS = {
  ticker: 'ASML.AS',
  data_source: 'esef',
  market_snapshot: null,
  ratios_summary: { avg_npm: 28.2, avg_roe: 43.1 },
  per_year: [
    {
      year: 2023,
      revenue: 27600000000,
      net_income: 7800000000,
      total_assets: 30000000000,
      equity: 18000000000,
    },
  ],
}

// ── TickerCard ────────────────────────────────────────────────

describe('TickerCard — EU tickers', () => {
  it('emits the full ticker (ASML.AS) when an ESEF entry is clicked', async () => {
    const wrapper = mount(TickerCard, { props: { ticker: makeEsefTicker() } })
    await wrapper.find('[role="listitem"]').trigger('click')
    expect(wrapper.emitted('select')[0]).toEqual(['ASML.AS'])
  })

  it('shows the ESEF badge for entries with data_source=esef', () => {
    const wrapper = mount(TickerCard, { props: { ticker: makeEsefTicker() } })
    expect(wrapper.find('[data-testid="badge-esef"]').exists()).toBe(true)
  })

  it('does not show the ESEF badge for EDGAR entries', () => {
    const wrapper = mount(TickerCard, { props: { ticker: makeEdgarTicker() } })
    expect(wrapper.find('[data-testid="badge-esef"]').exists()).toBe(false)
  })

  it('emits symbol (AAPL) for NA entries without a ticker field', async () => {
    const wrapper = mount(TickerCard, { props: { ticker: makeEdgarTicker() } })
    await wrapper.find('[role="listitem"]').trigger('click')
    expect(wrapper.emitted('select')[0]).toEqual(['AAPL'])
  })

  it('displays the full ticker (ASML.AS) in the symbol slot for disambiguation', () => {
    const wrapper = mount(TickerCard, { props: { ticker: makeEsefTicker() } })
    expect(wrapper.find('.ticker-symbol').text()).toBe('ASML.AS')
  })

  it('displays just the symbol (AAPL) for NA entries', () => {
    const wrapper = mount(TickerCard, { props: { ticker: makeEdgarTicker() } })
    expect(wrapper.find('.ticker-symbol').text()).toBe('AAPL')
  })
})

// ── TickerSearch keyboard nav ─────────────────────────────────

describe('TickerSearch — EU ticker keyboard nav', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('emits full ticker (ASML.AS) on Enter for ESEF search result', async () => {
    vi.spyOn(tickersApi, 'searchAll').mockResolvedValue({
      query: 'asml',
      companies: [makeEsefTicker()],
      authorities: [],
    })

    const wrapper = mount(TickerSearch)
    await wrapper.find('input').setValue('asml')
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushPromises()

    // Arrow down to select first result, then Enter
    await wrapper.find('input').trigger('keydown', { key: 'ArrowDown' })
    await wrapper.find('input').trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')[0]).toEqual(['ASML.AS'])
  })

  it('emits full ticker via card click for ESEF result', async () => {
    vi.spyOn(tickersApi, 'searchAll').mockResolvedValue({
      query: 'asml',
      companies: [makeEsefTicker()],
      authorities: [],
    })

    const wrapper = mount(TickerSearch)
    await wrapper.find('input').setValue('asml')
    await nextTick()
    vi.advanceTimersByTime(300)
    await flushPromises()

    await wrapper.find('[role="listitem"]').trigger('click')
    expect(wrapper.emitted('select')[0]).toEqual(['ASML.AS'])
  })
})

// ── HomeView — EU tab filtering ────────────────────────────────

const TickerFinancialsStub = {
  name: 'TickerFinancials',
  template: '<div data-testid="ticker-financials" />',
  props: ['symbol', 'view'],
  emits: ['close'],
}

const DataViewSelectorStub = {
  name: 'DataViewSelector',
  template: '<div data-testid="data-view-selector" />',
  props: ['modelValue', 'groups'],
  emits: ['update:modelValue'],
}

const TickerSearchStub = {
  name: 'TickerSearch',
  template: '<div data-testid="ticker-search" />',
  props: ['selectedSymbol'],
  emits: ['select'],
}

function makeHomeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/c/:ticker', redirect: (to) => `/c/${to.params.ticker}/profile` },
      { path: '/c/:ticker/:view', component: HomeView },
    ],
  })
}

async function mountHomeAt(path) {
  const router = makeHomeRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(HomeView, {
    global: {
      plugins: [router],
      stubs: {
        TickerSearch: TickerSearchStub,
        TickerFinancials: TickerFinancialsStub,
        DataViewSelector: DataViewSelectorStub,
        ThemeToggle: { template: '<div />' },
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('HomeView — EU ticker routing', () => {
  it('shows Summary in grouped nav for EU tickers', async () => {
    const { wrapper } = await mountHomeAt('/c/ASML.AS/fundamentals')
    const selector = wrapper.findComponent(DataViewSelectorStub)
    const groups = selector.props('groups')
    const allViews = groups.flatMap((g) => g.views)
    expect(allViews.some((v) => v.key === 'summary')).toBe(true)
  })

  it('shows Summary in grouped nav for NA tickers', async () => {
    const { wrapper } = await mountHomeAt('/c/AAPL/summary')
    const selector = wrapper.findComponent(DataViewSelectorStub)
    const groups = selector.props('groups')
    const allViews = groups.flatMap((g) => g.views)
    expect(allViews.some((v) => v.key === 'summary')).toBe(true)
  })

  it('shows summary view for EU ticker on /summary', async () => {
    const { wrapper } = await mountHomeAt('/c/ASML.AS/summary')
    const financials = wrapper.findComponent(TickerFinancialsStub)
    expect(financials.props('view')).toBe('summary')
  })

  it('URL stays at /ASML.AS/summary (no redirect)', async () => {
    const { router } = await mountHomeAt('/c/ASML.AS/summary')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/c/ASML.AS/summary')
  })

  it('onTickerSelect navigates to /ASML.AS/summary for EU tickers', async () => {
    const { wrapper, router } = await mountHomeAt('/c/AAPL/summary')
    const pushSpy = vi.spyOn(router, 'push')
    await wrapper.findComponent(TickerSearchStub).vm.$emit('select', 'ASML.AS')
    expect(pushSpy).toHaveBeenCalledWith('/c/ASML.AS/summary')
  })

  it('shows fundamentals view for EU ticker navigating to /fundamentals', async () => {
    const { wrapper } = await mountHomeAt('/c/ASML.AS/fundamentals')
    const financials = wrapper.findComponent(TickerFinancialsStub)
    expect(financials.props('view')).toBe('fundamentals')
    expect(financials.props('symbol')).toBe('ASML.AS')
  })
})

// ── TickerFinancials — data_source badge ──────────────────────

describe('TickerFinancials — data_source badge', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('shows ESEF badge for EU tickers', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(ESEF_FUNDAMENTALS)
    const wrapper = mount(TickerFinancials, {
      props: { symbol: 'ASML.AS', view: 'fundamentals' },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="badge-source-esef"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="badge-source-edgar"]').exists()).toBe(false)
  })

  it('shows EDGAR badge for NA tickers', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue({
      ticker: 'AAPL',
      data_source: 'edgar',
      market_snapshot: null,
      ratios_summary: {},
      per_year: [],
    })
    const wrapper = mount(TickerFinancials, {
      props: { symbol: 'AAPL', view: 'fundamentals' },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="badge-source-edgar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="badge-source-esef"]').exists()).toBe(false)
  })
})
