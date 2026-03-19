import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import HomeView from '../../src/views/HomeView.vue'

// Stub child components to isolate HomeView logic
const TickerSearchStub = {
  name: 'TickerSearch',
  template: '<div data-testid="ticker-search" />',
  props: ['selectedSymbol'],
  emits: ['select'],
}

const TickerFinancialsStub = {
  name: 'TickerFinancials',
  template: '<div data-testid="ticker-financials" />',
  props: ['symbol', 'view'],
  emits: ['close'],
}

const DataViewSelectorStub = {
  name: 'DataViewSelector',
  template: '<div data-testid="data-view-selector" />',
  props: ['modelValue', 'views'],
  emits: ['update:modelValue'],
}

const ThemeToggleStub = { template: '<div />' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/:ticker', redirect: (to) => `/${to.params.ticker}/fundamentals` },
      { path: '/:ticker/:view', component: HomeView },
    ],
  })
}

async function mountAt(path = '/') {
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const wrapper = mount(HomeView, {
    global: {
      plugins: [router],
      stubs: {
        TickerSearch: TickerSearchStub,
        TickerFinancials: TickerFinancialsStub,
        DataViewSelector: DataViewSelectorStub,
        ThemeToggle: ThemeToggleStub,
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('HomeView', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Root route ──────────────────────────────────────────────
  it('does not show TickerFinancials on the root route', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="ticker-financials"]').exists()).toBe(false)
  })

  it('does not show DataViewSelector on the root route', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="data-view-selector"]').exists()).toBe(false)
  })

  it('passes null selectedSymbol to TickerSearch on root route', async () => {
    const { wrapper } = await mountAt('/')
    const search = wrapper.findComponent({ name: 'TickerSearch' })
    expect(search.props('selectedSymbol')).toBeNull()
  })

  // ── Ticker + view route ──────────────────────────────────────
  it('shows TickerFinancials when the route has ticker and view params', async () => {
    const { wrapper } = await mountAt('/AAPL/fundamentals')
    expect(wrapper.find('[data-testid="ticker-financials"]').exists()).toBe(true)
  })

  it('shows DataViewSelector when the route has ticker and view params', async () => {
    const { wrapper } = await mountAt('/AAPL/fundamentals')
    expect(wrapper.find('[data-testid="data-view-selector"]').exists()).toBe(true)
  })

  it('passes the ticker param as selectedSymbol to TickerSearch', async () => {
    const { wrapper } = await mountAt('/MSFT/fundamentals')
    const search = wrapper.findComponent({ name: 'TickerSearch' })
    expect(search.props('selectedSymbol')).toBe('MSFT')
  })

  it('passes the correct symbol prop to TickerFinancials', async () => {
    const { wrapper } = await mountAt('/GOOG/fundamentals')
    const fin = wrapper.findComponent({ name: 'TickerFinancials' })
    expect(fin.props('symbol')).toBe('GOOG')
  })

  it('passes the view param to TickerFinancials', async () => {
    const { wrapper } = await mountAt('/AAPL/fundamentals')
    const fin = wrapper.findComponent({ name: 'TickerFinancials' })
    expect(fin.props('view')).toBe('fundamentals')
  })

  it('passes gmr-long view prop to TickerFinancials for gmr-long route', async () => {
    const { wrapper } = await mountAt('/AAPL/gmr-long')
    const fin = wrapper.findComponent({ name: 'TickerFinancials' })
    expect(fin.props('view')).toBe('gmr-long')
  })

  it('passes the current view as modelValue to DataViewSelector', async () => {
    const { wrapper } = await mountAt('/AAPL/gmr-long')
    const sel = wrapper.findComponent({ name: 'DataViewSelector' })
    expect(sel.props('modelValue')).toBe('gmr-long')
  })

  // ── Navigation ───────────────────────────────────────────────
  it('navigates to /AAPL/fundamentals when TickerSearch emits select("AAPL") from root', async () => {
    const { wrapper, router } = await mountAt('/')
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper.findComponent({ name: 'TickerSearch' }).vm.$emit('select', 'AAPL')

    expect(pushSpy).toHaveBeenCalledWith('/AAPL/fundamentals')
  })

  it('preserves current view when selecting a new ticker', async () => {
    const { wrapper, router } = await mountAt('/AAPL/gmr-long')
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper.findComponent({ name: 'TickerSearch' }).vm.$emit('select', 'MSFT')

    expect(pushSpy).toHaveBeenCalledWith('/MSFT/gmr-long')
  })

  it('navigates to /:ticker/gmr-long when DataViewSelector emits update:modelValue', async () => {
    const { wrapper, router } = await mountAt('/AAPL/fundamentals')
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper
      .findComponent({ name: 'DataViewSelector' })
      .vm.$emit('update:modelValue', 'gmr-long')

    expect(pushSpy).toHaveBeenCalledWith('/AAPL/gmr-long')
  })

  it('navigates to / when TickerFinancials emits close', async () => {
    const { wrapper, router } = await mountAt('/AAPL/fundamentals')
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper.findComponent({ name: 'TickerFinancials' }).vm.$emit('close')

    expect(pushSpy).toHaveBeenCalledWith('/')
  })
})
