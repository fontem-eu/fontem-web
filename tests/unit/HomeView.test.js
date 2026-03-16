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
  props: ['symbol'],
  emits: ['close'],
}

const ThemeToggleStub = { template: '<div />' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/:ticker', component: HomeView },
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

  it('does not show TickerFinancials on the root route', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="ticker-financials"]').exists()).toBe(false)
  })

  it('shows TickerFinancials when the route has a ticker param', async () => {
    const { wrapper } = await mountAt('/AAPL')
    expect(wrapper.find('[data-testid="ticker-financials"]').exists()).toBe(true)
  })

  it('passes the ticker param as selectedSymbol to TickerSearch', async () => {
    const { wrapper } = await mountAt('/MSFT')
    const search = wrapper.findComponent({ name: 'TickerSearch' })
    expect(search.props('selectedSymbol')).toBe('MSFT')
  })

  it('passes null selectedSymbol to TickerSearch on root route', async () => {
    const { wrapper } = await mountAt('/')
    const search = wrapper.findComponent({ name: 'TickerSearch' })
    expect(search.props('selectedSymbol')).toBeNull()
  })

  it('navigates to /AAPL when TickerSearch emits select("AAPL")', async () => {
    const { wrapper, router } = await mountAt('/')
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper.findComponent({ name: 'TickerSearch' }).vm.$emit('select', 'AAPL')

    expect(pushSpy).toHaveBeenCalledWith('/AAPL')
  })

  it('navigates to / when TickerFinancials emits close', async () => {
    const { wrapper, router } = await mountAt('/AAPL')
    const pushSpy = vi.spyOn(router, 'push')

    await wrapper.findComponent({ name: 'TickerFinancials' }).vm.$emit('close')

    expect(pushSpy).toHaveBeenCalledWith('/')
  })

  it('passes the correct symbol prop to TickerFinancials', async () => {
    const { wrapper } = await mountAt('/GOOG')
    const fin = wrapper.findComponent({ name: 'TickerFinancials' })
    expect(fin.props('symbol')).toBe('GOOG')
  })
})
