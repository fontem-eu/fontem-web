import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BalancePanel from '../../src/components/BalancePanel.vue'

// ── Mock D3 ───────────────────────────────────────────────────

vi.mock('d3', () => {
  const chainable = {}
  ;['select', 'selectAll', 'append', 'attr', 'call', 'remove', 'data', 'join', 'text'].forEach(
    (m) => { chainable[m] = vi.fn(() => chainable) }
  )
  chainable.node = vi.fn(() => null)

  const scaleLinFn = () => {
    const fn = (v) => (typeof v === 'number' ? v : 0)
    fn.domain = () => fn; fn.range = () => fn; fn.nice = () => fn; fn.ticks = () => []
    return fn
  }
  const scaleBandFn = () => {
    const fn = () => 0
    fn.domain = () => fn; fn.range = () => fn; fn.padding = () => fn; fn.bandwidth = () => 10
    return fn
  }
  const axisFn = () => {
    const fn = () => {}
    fn.ticks = () => fn; fn.tickFormat = () => fn; fn.tickSize = () => fn
    return fn
  }

  return {
    select:      vi.fn(() => chainable),
    scaleLinear: vi.fn(scaleLinFn),
    scaleBand:   vi.fn(scaleBandFn),
    axisLeft:    vi.fn(axisFn),
    axisBottom:  vi.fn(axisFn),
    max:         vi.fn(() => 6.2e11),
    min:         vi.fn(() => 0),
  }
})

// ── Mock ResizeObserver ───────────────────────────────────────

const mockResizeObserver = { observe: vi.fn(), disconnect: vi.fn() }
vi.stubGlobal('ResizeObserver', vi.fn(() => mockResizeObserver))

// ── Fixture ───────────────────────────────────────────────────

const FIXTURE = {
  ticker: 'MSFT',
  ratios_summary: {
    avg_debt_to_equity: 1.45,
    avg_debt_to_assets: 0.57,
    avg_current_ratio: 2.08,
    avg_quick_ratio: 1.89,
    avg_roe: 34.39,
    avg_roa: 14.79,
  },
  per_year: [
    {
      year: 2024,
      total_assets: 512163000000,
      total_liabilities: 243686000000,
      equity: 268477000000,
      book_value_per_share: 36.14,
      revenue_per_share: 32.99,
      current_ratio: 1.27,
      quick_ratio: 1.15,
      debt_to_equity: 0.91,
      debt_to_assets: 0.48,
      roe: 32.83,
      roa: 17.21,
    },
    {
      year: 2025,
      total_assets: 619003000000,
      total_liabilities: 275524000000,
      equity: 343479000000,
      book_value_per_share: 46.26,
      revenue_per_share: 37.94,
      current_ratio: 1.35,
      quick_ratio: 1.20,
      debt_to_equity: 0.80,
      debt_to_assets: 0.45,
      roe: 29.65,
      roa: 16.45,
    },
  ],
}

import * as d3 from 'd3'

// ── Tests ─────────────────────────────────────────────────────

describe('BalancePanel', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.restoreAllMocks())

  // ── Averages strip ────────────────────────────────────────

  it('renders the averages strip', () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="balance-averages"]').exists()).toBe(true)
  })

  it('shows all expected average labels', () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE } })
    const text = w.find('[data-testid="balance-averages"]').text()
    expect(text).toContain('Avg D/E')
    expect(text).toContain('Avg D/A')
    expect(text).toContain('Avg Current Ratio')
    expect(text).toContain('Avg Quick Ratio')
    expect(text).toContain('Avg ROE')
    expect(text).toContain('Avg ROA')
  })

  it('formats Avg D/E correctly (1.45)', () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="balance-averages"]').text()).toContain('1.45')
  })

  it('formats Avg ROE as percentage (34.4%)', () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="balance-averages"]').text()).toContain('34.4%')
  })

  it('shows — for null ratios_summary values', () => {
    const data = { ...FIXTURE, ratios_summary: { avg_debt_to_equity: null } }
    const w = mount(BalancePanel, { props: { data } })
    expect(w.find('[data-testid="balance-averages"]').text()).toContain('—')
  })

  // ── Chart ─────────────────────────────────────────────────

  it('renders the chart container element', async () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE }, attachTo: document.body })
    await flushPromises()
    expect(w.find('[data-testid="balance-chart"]').exists()).toBe(true)
  })

  it('calls d3.select to draw the chart', async () => {
    mount(BalancePanel, { props: { data: FIXTURE }, attachTo: document.body })
    await flushPromises()
    expect(d3.select).toHaveBeenCalled()
  })

  // ── Per-year table ────────────────────────────────────────

  it('renders the per-year table', () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="balance-table"]').exists()).toBe(true)
  })

  it('shows all expected row labels in the per-year table', () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE } })
    const text = w.find('[data-testid="balance-table"]').text()
    expect(text).toContain('Total Assets')
    expect(text).toContain('Total Liabilities')
    expect(text).toContain('Equity')
    expect(text).toContain('Book Value/Share')
    expect(text).toContain('Revenue/Share')
    expect(text).toContain('Current Ratio')
    expect(text).toContain('Quick Ratio')
    expect(text).toContain('D/E')
    expect(text).toContain('D/A')
    expect(text).toContain('ROE')
    expect(text).toContain('ROA')
  })

  it('shows years sorted descending (2025 before 2024)', () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE } })
    const headers = w.findAll('[data-testid="balance-table"] thead th')
    const years = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(years[0]).toBe('2025')
    expect(years[1]).toBe('2024')
  })

  it('formats total assets as $512.2B for 2024', () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="balance-table"]').text()).toContain('$512.2B')
  })

  it('formats equity as $268.5B for 2024', () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="balance-table"]').text()).toContain('$268.5B')
  })

  it('formats book value per share as $36.14 for 2024', () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="balance-table"]').text()).toContain('$36.14')
  })

  it('formats current ratio (1.27) for 2024', () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="balance-table"]').text()).toContain('1.27')
  })

  it('formats ROE as percentage (32.8%) for 2024', () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="balance-table"]').text()).toContain('32.8%')
  })

  it('displayYears=1 shows only the most recent year', () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE, displayYears: 1 } })
    const headers = w.findAll('[data-testid="balance-table"] thead th')
    const years = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(years).toHaveLength(1)
    expect(years[0]).toBe('2025')
  })

  it('shows — for null balance sheet values', () => {
    const data = {
      ...FIXTURE,
      per_year: [{ year: 2025, total_assets: null, equity: null }],
    }
    const w = mount(BalancePanel, { props: { data } })
    expect(w.find('[data-testid="balance-table"]').text()).toContain('—')
  })

  it('does not mark positive equity with gmr-ann__neg', () => {
    const w = mount(BalancePanel, { props: { data: FIXTURE } })
    expect(w.findAll('.gmr-ann__neg').length).toBe(0)
  })

  it('rows with only equity filter correctly (no total_assets)', () => {
    const data = {
      ...FIXTURE,
      per_year: [{ year: 2025, total_assets: null, equity: 200e9 }],
    }
    const w = mount(BalancePanel, { props: { data } })
    const headers = w.findAll('[data-testid="balance-table"] thead th')
    const years = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(years).toContain('2025')
  })
})
