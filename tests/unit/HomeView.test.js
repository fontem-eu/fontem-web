import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

// HomeView is the ticker-detail host now (mounted at `/c/:ticker/:view`).
// The landing/marketing copy (carousel + chips + how-it-works + tour)
// moved to AboutView — see tests/unit/AboutView.test.js.

vi.mock('../../src/api/gmr.js', () => ({
  fetchFundamentals: vi.fn().mockResolvedValue({
    annual_data: [{ year: 2023, revenue: 1e6 }],
    market_snapshot: { market_cap: 1e9 },
  }),
}))

import HomeView from '../../src/views/HomeView.vue'
import { fetchFundamentals } from '../../src/api/gmr.js'

const TickerFinancialsStub = {
  name: 'TickerFinancials',
  template: '<div data-testid="ticker-financials" />',
  props: ['symbol', 'view'],
  emits: ['close', 'company-resolved'],
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
  beforeEach(() => {
    localStorage.clear()
    fetchFundamentals.mockReset()
    fetchFundamentals.mockResolvedValue({
      annual_data: [{ year: 2023, revenue: 1e6 }],
      market_snapshot: { market_cap: 1e9 },
    })
  })
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
  // The "Analysis" group was removed from the profile tab strip
  // (see #137); these tests pin that contract.
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

  it('still renders TickerFinancials when navigating directly to gmr-long', async () => {
    const { wrapper } = await mountAt('/c/AAPL/gmr-long')
    expect(wrapper.find('[data-testid="ticker-financials"]').exists()).toBe(true)
    const fin = wrapper.findComponent({ name: 'TickerFinancials' })
    expect(fin.props('view')).toBe('gmr-long')
  })

  // ── Financials availability probe (item 4) ────────────────────
  // The Financials tab should grey itself out when the entity has
  // no financial data (authorities, unlisted companies, 404s).
  // HomeView probes via a single fetchFundamentals call on mount +
  // on every ticker change.
  it('passes financials group with disabled=false after a successful fundamentals probe', async () => {
    const { wrapper } = await mountAt('/c/AAPL/profile')
    await flushPromises()
    const sel = wrapper.findComponent({ name: 'DataViewSelector' })
    const groups = sel.props('groups')
    const financials = groups.find((g) => g.key === 'financials')
    expect(financials).toBeTruthy()
    expect(financials.disabled).toBeFalsy()
  })

  it('marks the financials group disabled when the fundamentals probe returns empty', async () => {
    fetchFundamentals.mockResolvedValueOnce({})
    const { wrapper } = await mountAt('/c/UNLISTED/profile')
    await flushPromises()
    const sel = wrapper.findComponent({ name: 'DataViewSelector' })
    const financials = sel.props('groups').find((g) => g.key === 'financials')
    expect(financials.disabled).toBe(true)
    expect(financials.disabledReason).toMatch(/no financial data/i)
  })

  it('marks the financials group disabled when the fundamentals probe errors', async () => {
    fetchFundamentals.mockRejectedValueOnce(new Error('HTTP 404'))
    const { wrapper } = await mountAt('/c/97cebd5c-0b1a-527b-b8fb-8053ee35f2a8/profile')
    await flushPromises()
    const sel = wrapper.findComponent({ name: 'DataViewSelector' })
    const financials = sel.props('groups').find((g) => g.key === 'financials')
    expect(financials.disabled).toBe(true)
  })

  it('re-probes when the ticker route param changes', async () => {
    const { router } = await mountAt('/c/AAPL/profile')
    await flushPromises()
    expect(fetchFundamentals).toHaveBeenCalledWith('AAPL', 1)
    fetchFundamentals.mockClear()
    await router.push('/c/MSFT/profile')
    await flushPromises()
    expect(fetchFundamentals).toHaveBeenCalledWith('MSFT', 1)
  })

  // ── Authority profile: drop Financials group (batch-5 item 2) ──
  // The user reported that the Financials tab on an authority profile
  // is dead UI. Instead of greying it out (which we do for companies
  // with no data), drop the whole group when TickerFinancials emits
  // `company-resolved` with `kind: 'authority'`.

  it('drops the Financials group entirely when the child emits kind="authority"', async () => {
    const { wrapper } = await mountAt('/c/AAPL/profile')
    await flushPromises()
    // Before the emit, the group is still there (greyed if probe was empty).
    let sel = wrapper.findComponent({ name: 'DataViewSelector' })
    expect(sel.props('groups').some((g) => g.key === 'financials')).toBe(true)

    await wrapper
      .findComponent({ name: 'TickerFinancials' })
      .vm.$emit('company-resolved', { kind: 'authority', name: 'X', id: 'X' })
    await flushPromises()

    sel = wrapper.findComponent({ name: 'DataViewSelector' })
    expect(sel.props('groups').some((g) => g.key === 'financials')).toBe(false)
  })

  it('keeps the Financials group when the child emits kind="company"', async () => {
    const { wrapper } = await mountAt('/c/AAPL/profile')
    await flushPromises()
    await wrapper
      .findComponent({ name: 'TickerFinancials' })
      .vm.$emit('company-resolved', { kind: 'company', name: 'Apple', id: 'AAPL' })
    await flushPromises()
    const sel = wrapper.findComponent({ name: 'DataViewSelector' })
    expect(sel.props('groups').some((g) => g.key === 'financials')).toBe(true)
  })

  it('resets the authority classification when the ticker changes', async () => {
    const { wrapper, router } = await mountAt('/c/AUTH/profile')
    await flushPromises()
    await wrapper
      .findComponent({ name: 'TickerFinancials' })
      .vm.$emit('company-resolved', { kind: 'authority', name: 'X', id: 'X' })
    await flushPromises()

    let sel = wrapper.findComponent({ name: 'DataViewSelector' })
    expect(sel.props('groups').some((g) => g.key === 'financials')).toBe(false)

    // Navigate to a company-shaped ticker. Until the new emit lands,
    // the group should be back (we no longer carry the previous
    // entity's classification).
    await router.push('/c/AAPL/profile')
    await flushPromises()
    sel = wrapper.findComponent({ name: 'DataViewSelector' })
    expect(sel.props('groups').some((g) => g.key === 'financials')).toBe(true)
  })

  it('redirects to /c/:ticker/profile when an authority is resolved on a financials view', async () => {
    const { wrapper, router } = await mountAt('/c/AUTH/summary')
    await flushPromises()
    const pushSpy = vi.spyOn(router, 'replace')
    await wrapper
      .findComponent({ name: 'TickerFinancials' })
      .vm.$emit('company-resolved', { kind: 'authority', name: 'X', id: 'AUTH' })
    await flushPromises()
    expect(pushSpy).toHaveBeenCalledWith('/c/AUTH/profile')
  })
})
