import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import IncomePanel from '../../src/components/IncomePanel.vue'

// ── Mock D3 ───────────────────────────────────────────────────

vi.mock('d3', () => {
  const chainable = {}
  ;['select', 'selectAll', 'append', 'attr', 'call', 'remove', 'data', 'join', 'datum', 'text'].forEach(
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
  const lineFn = () => {
    const fn = () => ''
    fn.x = () => fn; fn.y = () => fn; fn.curve = () => fn
    return fn
  }

  return {
    select:          vi.fn(() => chainable),
    scaleLinear:     vi.fn(scaleLinFn),
    scaleBand:       vi.fn(scaleBandFn),
    axisLeft:        vi.fn(axisFn),
    axisBottom:      vi.fn(axisFn),
    axisRight:       vi.fn(axisFn),
    line:            vi.fn(lineFn),
    max:             vi.fn(() => 3e11),
    min:             vi.fn(() => 0),
    extent:          vi.fn(() => [0, 3e11]),
    curveMonotoneX:  {},
  }
})

// ── Mock ResizeObserver ───────────────────────────────────────

const mockResizeObserver = { observe: vi.fn(), disconnect: vi.fn() }
vi.stubGlobal('ResizeObserver', vi.fn(() => mockResizeObserver))

// ── Fixture ───────────────────────────────────────────────────

const FIXTURE = {
  ticker: 'MSFT',
  ratios_summary: {
    avg_pe: 32.1,
    avg_ps: 10.3,
    avg_roe: 34.39,
    avg_npm: 32.07,
    avg_gross_margin: 67.97,
    avg_operating_margin: 39.83,
    avg_revenue_growth: 14.38,
    avg_earnings_growth: 27.71,
  },
  per_year: [
    {
      year: 2024,
      avg_price: 414.73,
      revenue: 245122000000,
      gross_profit: 171008000000,
      operating_income: 109433000000,
      net_income: 88136000000,
      eps: 11.86,
      gross_margin: 69.76,
      operating_margin: 44.64,
      npm: 35.96,
      revenue_growth: 15.67,
      earnings_growth: 21.8,
    },
    {
      year: 2025,
      avg_price: 461.78,
      revenue: 281724000000,
      gross_profit: 193893000000,
      operating_income: 128528000000,
      net_income: 101832000000,
      eps: 13.71,
      gross_margin: 68.82,
      operating_margin: 45.62,
      npm: 36.15,
      revenue_growth: 14.93,
      earnings_growth: 15.54,
    },
  ],
}

import * as d3 from 'd3'

// ── Tests ─────────────────────────────────────────────────────

describe('IncomePanel', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.restoreAllMocks())

  // ── Averages strip ────────────────────────────────────────

  it('renders the averages strip', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="income-averages"]').exists()).toBe(true)
  })

  it('shows all expected average labels', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE } })
    const text = w.find('[data-testid="income-averages"]').text()
    expect(text).toContain('Avg P/E')
    expect(text).toContain('Avg P/S')
    expect(text).toContain('Avg Rev. Growth')
    expect(text).toContain('Avg EPS Growth')
    expect(text).toContain('Avg Gross Margin')
    expect(text).toContain('Avg Net Margin')
  })

  it('formats Avg P/E correctly (32.1)', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="income-averages"]').text()).toContain('32.1')
  })

  it('formats Avg Net Margin as percentage (32.1%)', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="income-averages"]').text()).toContain('32.1%')
  })

  it('formats Avg Revenue Growth as percentage (14.4%)', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="income-averages"]').text()).toContain('14.4%')
  })

  it('shows — for null ratios_summary values', () => {
    const data = { ...FIXTURE, ratios_summary: { avg_pe: null, avg_ps: null } }
    const w = mount(IncomePanel, { props: { data } })
    expect(w.find('[data-testid="income-averages"]').text()).toContain('—')
  })

  // ── Chart ─────────────────────────────────────────────────

  it('renders the chart container element', async () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE }, attachTo: document.body })
    await flushPromises()
    expect(w.find('[data-testid="income-chart"]').exists()).toBe(true)
  })

  it('calls d3.select to draw the chart', async () => {
    mount(IncomePanel, { props: { data: FIXTURE }, attachTo: document.body })
    await flushPromises()
    expect(d3.select).toHaveBeenCalled()
  })

  // ── Per-year table ────────────────────────────────────────

  it('renders the per-year table', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="income-table"]').exists()).toBe(true)
  })

  it('shows all expected row labels in the per-year table', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE } })
    const text = w.find('[data-testid="income-table"]').text()
    expect(text).toContain('Revenue')
    expect(text).toContain('Gross Profit')
    expect(text).toContain('Op. Income')
    expect(text).toContain('Net Income')
    expect(text).toContain('EPS')
    expect(text).toContain('Gross Margin')
    expect(text).toContain('Op. Margin')
    expect(text).toContain('Net Margin')
    expect(text).toContain('Rev. Growth')
    expect(text).toContain('Earnings Growth')
  })

  it('shows years sorted descending (2025 before 2024)', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE } })
    const headers = w.findAll('[data-testid="income-table"] thead th')
    const years = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(years[0]).toBe('2025')
    expect(years[1]).toBe('2024')
  })

  it('shows both years as columns', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE } })
    const headers = w.findAll('[data-testid="income-table"] thead th')
    const years = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(years).toContain('2024')
    expect(years).toContain('2025')
  })

  it('formats revenue as $245.1B for 2024', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="income-table"]').text()).toContain('$245.1B')
  })

  it('formats EPS as $11.86 for 2024', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="income-table"]').text()).toContain('$11.86')
  })

  it('formats gross margin as percentage (69.8%) for 2024', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="income-table"]').text()).toContain('69.8%')
  })

  it('formats net margin as percentage', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="income-table"]').text()).toContain('36.0%')
  })

  it('displayYears=1 shows only the most recent year column', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE, displayYears: 1 } })
    const headers = w.findAll('[data-testid="income-table"] thead th')
    const years = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(years).toHaveLength(1)
    expect(years[0]).toBe('2025')
  })

  it('displayYears=2 shows both years with most recent first', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE, displayYears: 2 } })
    const headers = w.findAll('[data-testid="income-table"] thead th')
    const years = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(years).toHaveLength(2)
    expect(years[0]).toBe('2025')
  })

  it('shows — for null revenue', () => {
    const data = {
      ...FIXTURE,
      per_year: [{ year: 2025, revenue: null, net_income: null, eps: null }],
    }
    const w = mount(IncomePanel, { props: { data } })
    expect(w.find('[data-testid="income-table"]').text()).toContain('—')
  })

  it('marks negative net income cells with gmr-ann__neg class', () => {
    const data = {
      ...FIXTURE,
      per_year: [{ year: 2025, revenue: 100e9, net_income: -5e9 }],
    }
    const w = mount(IncomePanel, { props: { data } })
    expect(w.findAll('.gmr-ann__neg').length).toBeGreaterThan(0)
  })

  it('does not mark positive values with gmr-ann__neg', () => {
    const w = mount(IncomePanel, { props: { data: FIXTURE } })
    // All values in fixture are positive — no negative cells
    const negCells = w.findAll('.gmr-ann__neg')
    expect(negCells.length).toBe(0)
  })
})
