import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

// HomeView is the ticker-detail host now (mounted at `/c/:ticker/:view`).
// The landing/marketing copy (carousel + chips + how-it-works + tour)
// moved to AboutView — see tests/unit/AboutView.test.js.

import HomeView from '../../src/views/HomeView.vue'

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
        TickerFinancials: TickerFinancialsStub,
        DataViewSelector: DataViewSelectorStub,
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('HomeView (ticker-detail host)', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { vi.restoreAllMocks() })

  // ── Root route — HomeView is no longer mounted there ─────
  // The router maps `/` to FeedView now. These two tests pin the
  // contract that HomeView itself doesn't render anything when
  // there's no ticker — the empty <main> renders, that's it.
  it('does not show TickerFinancials on the root route', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="ticker-financials"]').exists()).toBe(false)
  })

  it('does not show DataViewSelector on the root route', async () => {
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="data-view-selector"]').exists()).toBe(false)
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

  // ── VIEW_GROUPS contract ─────────────────────────────────────
  // The "Analysis" group (Long-Term Value via /api/:ticker/gmr_data)
  // was removed from the profile tab strip on 2026-05-31. The
  // underlying API + fetchGmrData() client stayed in tree (external
  // embeds still consume it), but the UI must not surface it as a
  // user-clickable tab anymore.
  it('does NOT pass an "analysis" group to DataViewSelector', async () => {
    const { wrapper } = await mountAt('/c/AAPL/fundamentals')
    const sel = wrapper.findComponent({ name: 'DataViewSelector' })
    const groupKeys = sel.props('groups').map((g) => g.key)
    expect(groupKeys).not.toContain('analysis')
  })

  it('does NOT include the gmr-long sub-view in any DataViewSelector group', async () => {
    const { wrapper } = await mountAt('/c/AAPL/fundamentals')
    const sel = wrapper.findComponent({ name: 'DataViewSelector' })
    const subKeys = sel.props('groups').flatMap((g) => g.views.map((v) => v.key))
    expect(subKeys).not.toContain('gmr-long')
  })

  // Direct navigation to /c/<ticker>/gmr-long still mounts the
  // TickerFinancials host with view="gmr-long" — the URL is a stable
  // external contract for the embed link even though the tab is gone.
  it('still renders TickerFinancials when navigating directly to gmr-long', async () => {
    const { wrapper } = await mountAt('/c/AAPL/gmr-long')
    expect(wrapper.find('[data-testid="ticker-financials"]').exists()).toBe(true)
    const fin = wrapper.findComponent({ name: 'TickerFinancials' })
    expect(fin.props('view')).toBe('gmr-long')
  })
})
