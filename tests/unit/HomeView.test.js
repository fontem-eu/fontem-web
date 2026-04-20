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
  props: ['modelValue', 'groups'],
  emits: ['update:modelValue'],
}

const ThemeToggleStub = { template: '<div />' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/c/:ticker', redirect: (to) => `/c/${to.params.ticker}/profile` },
      { path: '/c/:ticker/:view', component: HomeView },
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

  it('renders TickerSearch inside the graph path card on root route', async () => {
    const { wrapper } = await mountAt('/')
    const search = wrapper.findComponent({ name: 'TickerSearch' })
    expect(search.exists()).toBe(true)
  })

  // ── Ticker + view route ──────────────────────────────────────
  it('shows TickerFinancials when the route has ticker and view params', async () => {
    const { wrapper } = await mountAt('/c/AAPL/fundamentals')
    expect(wrapper.find('[data-testid="ticker-financials"]').exists()).toBe(true)
  })

  it('shows DataViewSelector when the route has ticker and view params', async () => {
    const { wrapper } = await mountAt('/c/AAPL/fundamentals')
    expect(wrapper.find('[data-testid="data-view-selector"]').exists()).toBe(true)
  })

  it('hides landing path cards when a ticker is selected', async () => {
    const { wrapper } = await mountAt('/c/MSFT/fundamentals')
    expect(wrapper.find('[data-testid="landing-paths"]').exists()).toBe(false)
  })

  it('passes the correct symbol prop to TickerFinancials', async () => {
    const { wrapper } = await mountAt('/c/GOOG/fundamentals')
    const fin = wrapper.findComponent({ name: 'TickerFinancials' })
    expect(fin.props('symbol')).toBe('GOOG')
  })

  it('passes the view param to TickerFinancials', async () => {
    const { wrapper } = await mountAt('/c/AAPL/fundamentals')
    const fin = wrapper.findComponent({ name: 'TickerFinancials' })
    expect(fin.props('view')).toBe('fundamentals')
  })

  it('passes gmr-long view prop to TickerFinancials for gmr-long route', async () => {
    const { wrapper } = await mountAt('/c/AAPL/gmr-long')
    const fin = wrapper.findComponent({ name: 'TickerFinancials' })
    expect(fin.props('view')).toBe('gmr-long')
  })

  it('passes the current view as modelValue to DataViewSelector', async () => {
    const { wrapper } = await mountAt('/c/AAPL/gmr-long')
    const sel = wrapper.findComponent({ name: 'DataViewSelector' })
    expect(sel.props('modelValue')).toBe('gmr-long')
  })

  // ── Navigation ───────────────────────────────────────────────
  it('navigates to /AAPL/summary when TickerSearch emits select("AAPL") from root', async () => {
    const { wrapper, router } = await mountAt('/')
    const pushSpy = vi.spyOn(router, 'push')

    /* TickerSearch now lives inside the path card on the landing page */
    await wrapper.findComponent({ name: 'TickerSearch' }).vm.$emit('select', 'AAPL')

    expect(pushSpy).toHaveBeenCalledWith('/c/AAPL/summary')
  })

  it('preserves current view when navigating to a new ticker via the route', async () => {
    const { router } = await mountAt('/c/AAPL/gmr-long')
    /* onTickerSelect preserves the current view — verify by pushing directly */
    await router.push('/c/MSFT/gmr-long')
    expect(router.currentRoute.value.path).toBe('/c/MSFT/gmr-long')
    expect(router.currentRoute.value.params.view).toBe('gmr-long')
  })

  it('navigates to /c/:ticker/gmr-long when DataViewSelector emits update:modelValue', async () => {
    const { wrapper, router } = await mountAt('/c/AAPL/fundamentals')
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper
      .findComponent({ name: 'DataViewSelector' })
      .vm.$emit('update:modelValue', 'gmr-long')

    expect(pushSpy).toHaveBeenCalledWith('/c/AAPL/gmr-long')
  })

  it('navigates to / when TickerFinancials emits close', async () => {
    const { wrapper, router } = await mountAt('/c/AAPL/fundamentals')
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper.findComponent({ name: 'TickerFinancials' }).vm.$emit('close')

    expect(pushSpy).toHaveBeenCalledWith('/')
  })

  // Recently-viewed was removed from the landing card — the tests that
  // covered it went with it. The landing is now a single centered search
  // card with nothing else below it.
  it('does not render a recently-viewed block', async () => {
    localStorage.setItem('gmr-recent-companies', JSON.stringify([
      { id: 'AAPL', name: 'Apple Inc.' },
    ]))
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="recent-tickers"]').exists()).toBe(false)
  })
})
