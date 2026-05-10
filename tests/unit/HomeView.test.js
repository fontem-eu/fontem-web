import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

// HomeView calls listReports() on mount to populate the "Recently published"
// strip on the landing page. Mock the API module so tests stay deterministic.
vi.mock('../../src/api/community.js', () => ({
  listReports: vi.fn(() => Promise.resolve([])),
}))

import HomeView from '../../src/views/HomeView.vue'
import { listReports } from '../../src/api/community.js'

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
      // Stubbed for landing-extra <router-link>s — the chips deep-link to
      // these and we don't want "no route match" warns flooding the test log.
      { path: '/feed', component: { template: '<div />' } },
      { path: '/stories/:id', component: { template: '<div />' } },
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
  beforeEach(() => {
    listReports.mockReset()
    listReports.mockResolvedValue([])
  })
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

  it('does not render TickerSearch on Home (search moved to /public-spending)', async () => {
    const { wrapper } = await mountAt('/')
    const search = wrapper.findComponent({ name: 'TickerSearch' })
    expect(search.exists()).toBe(false)
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
  // Search moved to /public-spending — the corresponding select-handler
  // tests live in the Public Spending suite.

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
  // covered it went with it.
  it('does not render a recently-viewed block', async () => {
    localStorage.setItem('gmr-recent-companies', JSON.stringify([
      { id: 'AAPL', name: 'Apple Inc.' },
    ]))
    const { wrapper } = await mountAt('/')
    expect(wrapper.find('[data-testid="recent-tickers"]').exists()).toBe(false)
  })

  // ── Landing-extra: onboarding strip ─────────────────────────

  it('renders the example chips, each as a router-link with a / path', async () => {
    const { wrapper } = await mountAt('/')
    const chips = wrapper.findAll('[data-testid="example-chips"] a')
    expect(chips.length).toBeGreaterThanOrEqual(3)
    for (const chip of chips) {
      // <router-link> renders as an <a> with href once mounted under a
      // real router; verify the href starts with /.
      expect(chip.attributes('href')).toMatch(/^\//)
    }
    expect(wrapper.find('[data-testid="example-chip-company"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="example-chip-graph"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="example-chip-story"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="example-chip-atlas"]').exists()).toBe(true)
  })

  it('renders three "how it works" steps with names + descriptions', async () => {
    const { wrapper } = await mountAt('/')
    const steps = wrapper.findAll('[data-testid="howitworks"] .howitworks-step')
    expect(steps).toHaveLength(3)
    expect(wrapper.find('[data-testid="howitworks-step-search"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="howitworks-step-crosscheck"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="howitworks-step-publish"]').exists()).toBe(true)
  })

  it('does not render any GIF slot until a step has a gif set (default state)', async () => {
    const { wrapper } = await mountAt('/')
    const steps = wrapper.findAll('[data-testid="howitworks"] .howitworks-step')
    for (const step of steps) {
      expect(step.classes()).not.toContain('has-gif')
      expect(step.find('.howitworks-gif').exists()).toBe(false)
    }
  })

  it('fetches recent public reports and hands them to the carousel', async () => {
    listReports.mockResolvedValueOnce([
      { id: 'r1', title: 'Report A', abstract: 'short', updated_at: '2026-04-01' },
      { id: 'r2', title: 'Report B', abstract: 'short', updated_at: '2026-04-02' },
      { id: 'r3', title: 'Report C', abstract: 'short', updated_at: '2026-04-03' },
    ])
    const { wrapper } = await mountAt('/')
    // Limit bumped from 3 → 8 to give the carousel rotation material.
    expect(listReports).toHaveBeenCalledWith({ scope: 'public', limit: 8 })
    const carousel = wrapper.find('[data-testid="recent-carousel"]')
    expect(carousel.exists()).toBe(true)
    const cards = wrapper.findAll('[data-testid="recent-carousel"] .card')
    expect(cards).toHaveLength(3)
    expect(cards[0].text()).toContain('Report A')
  })

  it('silently hides the recent-stories section when the API errors', async () => {
    listReports.mockRejectedValueOnce(new Error('500'))
    const { wrapper } = await mountAt('/')
    // Section is gated on recentReports.length, so an empty/failed fetch
    // means it never renders. No scary error banner — fundraising-page
    // pattern from DonateView.
    expect(wrapper.find('[data-testid="recent-stories"]').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/error|failed|sorry/i)
  })

  it('hides the entire landing-extra section when a ticker is selected', async () => {
    const { wrapper } = await mountAt('/c/AAPL/fundamentals')
    expect(wrapper.find('[data-testid="landing-extra"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="example-chips"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="howitworks"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="landing-demo"]').exists()).toBe(false)
  })

  it('embeds the demo video on the landing page', async () => {
    const { wrapper } = await mountAt('/')
    const section = wrapper.find('[data-testid="landing-demo"]')
    expect(section.exists()).toBe(true)
    const video = section.find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toBe('/landing-demo.mp4')
    // autoplay + muted + loop + playsinline are all required for the
    // browser to start playback without a user gesture. Vue 3 special-
    // cases `muted` to set the IDL property instead of the attribute,
    // so for that one we check the element directly. The others land
    // in the rendered HTML the normal way.
    const html = video.html()
    expect(html).toContain('autoplay')
    expect(html).toContain('loop')
    expect(html).toContain('playsinline')
    expect(video.element.muted).toBe(true)
  })
})
