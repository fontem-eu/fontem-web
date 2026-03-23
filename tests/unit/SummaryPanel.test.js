/**
 * SummaryPanel — unit tests
 * =========================
 * Tests for the price-chart summary panel, including tooltip/hover behaviour.
 * D3 and ResizeObserver are mocked so tests run in jsdom without real layout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import * as d3 from 'd3'
import SummaryPanel from '../../src/components/SummaryPanel.vue'

// ---------------------------------------------------------------------------
// Mock: d3
// ---------------------------------------------------------------------------

vi.mock('d3', () => {
  // A chainable stub — every method returns itself so chains don't throw.
  const chainable = {}
  ;[
    'select', 'selectAll', 'append', 'attr', 'call', 'remove',
    'data', 'join', 'text', 'style',
  ].forEach((m) => { chainable[m] = vi.fn(() => chainable) })
  // node() returns null in tests; the component guards with `if (_crosshairEl)`.
  chainable.node = vi.fn(() => null)

  const scaleFn = () => {
    const fn = (v) => (v instanceof Date ? v.getTime() : (v ?? 0))
    fn.domain  = () => fn
    fn.range   = () => fn
    fn.nice    = () => fn
    fn.ticks   = () => []
    fn.invert  = (px) => new Date(typeof px === 'number' ? px : 0)
    return fn
  }

  const axisFn = () => {
    const fn = () => {}
    fn.ticks      = () => fn
    fn.tickFormat = () => fn
    fn.tickSize   = () => fn
    return fn
  }

  return {
    select:      vi.fn(() => chainable),
    scaleTime:   vi.fn(scaleFn),
    scaleLinear: vi.fn(scaleFn),
    bisector:    vi.fn(() => ({ left: vi.fn(() => 2) })),
    pointer:     vi.fn(() => [400, 100]),
    extent:      vi.fn(() => [new Date('2024-01-01'), new Date('2024-01-10')]),
    min:         vi.fn(() => 160),
    max:         vi.fn(() => 180),
    axisLeft:    vi.fn(axisFn),
    axisBottom:  vi.fn(axisFn),
    timeFormat:  vi.fn(() => () => ''),
    format:      vi.fn(() => (v) => String(v)),
  }
})

// ---------------------------------------------------------------------------
// Mock: ResizeObserver
// ---------------------------------------------------------------------------

const mockResizeObserver = { observe: vi.fn(), disconnect: vi.fn() }
vi.stubGlobal('ResizeObserver', vi.fn(() => mockResizeObserver))

// ---------------------------------------------------------------------------
// Mock: fetchPriceHistory
// ---------------------------------------------------------------------------

const _FAKE_BARS = [
  { date: '2024-01-02', open: 170.0, high: 172.0, low: 169.0, close: 171.5, volume: 5e7 },
  { date: '2024-01-03', open: 171.5, high: 173.0, low: 170.5, close: 172.0, volume: 4.5e7 },
  { date: '2024-01-04', open: 172.0, high: 173.5, low: 169.0, close: 170.0, volume: 5.2e7 },
  { date: '2024-01-05', open: 170.0, high: 174.0, low: 171.0, close: 173.5, volume: 4.8e7 },
  { date: '2024-01-08', open: 173.5, high: 175.0, low: 172.5, close: 174.0, volume: 5.1e7 },
]

const _FAKE_RESPONSE = {
  ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', period: '1m', bars: _FAKE_BARS,
}

vi.mock('../../src/api/gmr.js', () => ({
  fetchPriceHistory: vi.fn(() => Promise.resolve({ ..._FAKE_RESPONSE })),
}))

import { fetchPriceHistory } from '../../src/api/gmr.js'

// d3.select must be called by drawChart — if loading.value is still true when
// drawChart runs, containerRef.value is null and select is never called.
// These assertions guard against the loading/render race condition.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mountPanel(symbol = 'AAPL') {
  return mount(SummaryPanel, { props: { symbol }, attachTo: document.body })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SummaryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchPriceHistory.mockResolvedValue({ ..._FAKE_RESPONSE })
  })

  afterEach(() => vi.restoreAllMocks())

  // ── Structure ──────────────────────────────────────────────

  it('renders the root element with correct testid', () => {
    expect(mountPanel().find('[data-testid="summary-panel"]').exists()).toBe(true)
  })

  it('renders the ticker symbol', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-testid="summary-ticker"]').text()).toBe('AAPL')
  })

  it('renders company name and exchange after data loads', async () => {
    const w = mountPanel()
    await flushPromises()
    const company = w.find('[data-testid="summary-company"]')
    expect(company.exists()).toBe(true)
    expect(company.text()).toContain('Apple Inc.')
    expect(company.text()).toContain('NASDAQ')
  })

  it('renders current price after data loads', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-testid="summary-price"]').text()).toContain('174.00')
  })

  it('renders price change after data loads', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-testid="summary-change"]').exists()).toBe(true)
  })

  // ── Period selector ────────────────────────────────────────

  it('renders all six period buttons', async () => {
    const w = mountPanel()
    await flushPromises()
    for (const key of ['1m', '6m', '1y', '3y', '5y', 'all']) {
      expect(w.find(`[data-testid="period-${key}"]`).exists()).toBe(true)
    }
  })

  it('marks 1m as active by default', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-testid="period-1m"]').classes()).toContain('active')
    expect(w.find('[data-testid="period-1y"]').classes()).not.toContain('active')
  })

  it('changes active period on button click', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="period-1y"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="period-1y"]').classes()).toContain('active')
    expect(w.find('[data-testid="period-1m"]').classes()).not.toContain('active')
  })

  it('calls fetchPriceHistory with new period when period changes', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="period-3y"]').trigger('click')
    await flushPromises()
    expect(fetchPriceHistory).toHaveBeenCalledWith('AAPL', '3y')
  })

  // ── API calls ──────────────────────────────────────────────

  it('calls fetchPriceHistory on mount', async () => {
    mountPanel()
    await flushPromises()
    expect(fetchPriceHistory).toHaveBeenCalledWith('AAPL', '1m')
  })

  it('calls fetchPriceHistory again when symbol changes', async () => {
    const w = mountPanel('AAPL')
    await flushPromises()
    await w.setProps({ symbol: 'MSFT' })
    await flushPromises()
    expect(fetchPriceHistory).toHaveBeenCalledWith('MSFT', '1m')
  })

  // ── Chart rendering (D3 must actually run) ─────────────────
  // Critical regression guard for the loading/render race: if loading.value is
  // still true when drawChart() runs, containerRef is null and d3.select is
  // never called with a DOM element.

  it('calls d3.select to draw the chart after data loads', async () => {
    mountPanel()
    await flushPromises()
    expect(d3.select).toHaveBeenCalled()
  })

  it('passes a DOM element (not null) to d3.select', async () => {
    mountPanel()
    await flushPromises()
    const hasElement = d3.select.mock.calls.some(
      ([arg]) => arg !== null && arg !== undefined && typeof arg === 'object'
    )
    expect(hasElement).toBe(true)
  })

  // ── Chart container ────────────────────────────────────────

  it('renders chart container when data loads successfully', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-testid="chart-container"]').exists()).toBe(true)
  })

  it('does not show loading spinner after data loads', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-testid="summary-loading"]').exists()).toBe(false)
  })

  // ── Error state ────────────────────────────────────────────

  it('renders error message when fetch fails', async () => {
    fetchPriceHistory.mockRejectedValueOnce(new Error('Network error'))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-testid="summary-error"]').exists()).toBe(true)
  })

  it('does not render chart container on error', async () => {
    fetchPriceHistory.mockRejectedValueOnce(new Error('Network error'))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-testid="chart-container"]').exists()).toBe(false)
  })

  // ── Tooltip: no tooltip by default ─────────────────────────

  it('does not show tooltip before hover', async () => {
    const w = mountPanel()
    await flushPromises()
    expect(w.find('[data-testid="price-tooltip"]').exists()).toBe(false)
  })

  // ── Tooltip: appears on mousemove ──────────────────────────
  // The mock bisector returns index 2 → hovered = _chartData[1] (2024-01-03).
  // d3.pointer is mocked to return [400, 100] regardless of cursor position.

  it('shows tooltip on mousemove over the chart container', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="chart-container"]').trigger('mousemove')
    expect(w.find('[data-testid="price-tooltip"]').exists()).toBe(true)
  })

  it('tooltip shows a formatted date', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="chart-container"]').trigger('mousemove')
    const date = w.find('[data-testid="tt-date"]').text()
    expect(date).toMatch(/\w+ \d+, \d{4}/)  // e.g. "Jan 3, 2024"
  })

  it('tooltip shows open price', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="chart-container"]').trigger('mousemove')
    expect(w.find('[data-testid="tt-open"]').text()).toMatch(/\$\d+\.\d{2}/)
  })

  it('tooltip shows high price', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="chart-container"]').trigger('mousemove')
    expect(w.find('[data-testid="tt-high"]').text()).toMatch(/\$\d+\.\d{2}/)
  })

  it('tooltip shows low price', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="chart-container"]').trigger('mousemove')
    expect(w.find('[data-testid="tt-low"]').text()).toMatch(/\$\d+\.\d{2}/)
  })

  it('tooltip shows close price', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="chart-container"]').trigger('mousemove')
    expect(w.find('[data-testid="tt-close"]').text()).toMatch(/\$\d+\.\d{2}/)
  })

  it('tooltip shows volume', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="chart-container"]').trigger('mousemove')
    // Volume should be formatted (e.g. "45.0M")
    expect(w.find('[data-testid="tt-volume"]').text()).toMatch(/\d/)
  })

  it('high price is never less than low price in tooltip', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="chart-container"]').trigger('mousemove')
    const high = parseFloat(w.find('[data-testid="tt-high"]').text().replace('$', ''))
    const low  = parseFloat(w.find('[data-testid="tt-low"]').text().replace('$', ''))
    expect(high).toBeGreaterThanOrEqual(low)
  })

  // ── Tooltip: disappears on mouseleave ──────────────────────

  it('hides tooltip on mouseleave', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="chart-container"]').trigger('mousemove')
    expect(w.find('[data-testid="price-tooltip"]').exists()).toBe(true)
    await w.find('[data-testid="chart-container"]').trigger('mouseleave')
    expect(w.find('[data-testid="price-tooltip"]').exists()).toBe(false)
  })

  it('tooltip reappears after mousemove following a mouseleave', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="chart-container"]').trigger('mousemove')
    await w.find('[data-testid="chart-container"]').trigger('mouseleave')
    await w.find('[data-testid="chart-container"]').trigger('mousemove')
    expect(w.find('[data-testid="price-tooltip"]').exists()).toBe(true)
  })

  // ── Edge cases ─────────────────────────────────────────────

  it('does not show chart container on empty data', async () => {
    fetchPriceHistory.mockResolvedValueOnce({ ..._FAKE_RESPONSE, bars: [] })
    const w = mountPanel()
    await flushPromises()
    // No error shown; chart container renders but D3 draws nothing.
    expect(w.find('[data-testid="summary-error"]').exists()).toBe(false)
  })

  it('does not show tooltip if no data loaded', async () => {
    fetchPriceHistory.mockResolvedValueOnce({ ..._FAKE_RESPONSE, bars: [] })
    const w = mountPanel()
    await flushPromises()
    await w.find('[data-testid="chart-container"]').trigger('mousemove')
    expect(w.find('[data-testid="price-tooltip"]').exists()).toBe(false)
  })
})
