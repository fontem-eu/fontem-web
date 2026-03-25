import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CashflowPanel from '../../src/components/CashflowPanel.vue'

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
    max:         vi.fn(() => 1.5e11),
    min:         vi.fn(() => -7e10),
    extent:      vi.fn(() => [-7e10, 1.5e11]),
  }
})

// ── Mock ResizeObserver ───────────────────────────────────────

const mockResizeObserver = { observe: vi.fn(), disconnect: vi.fn() }
vi.stubGlobal('ResizeObserver', vi.fn(() => mockResizeObserver))

// ── Fixture ───────────────────────────────────────────────────

const FIXTURE = {
  ticker: 'MSFT',
  ratios_summary: {
    avg_fcf_yield: 2.1,
    avg_dividend_yield: 0.8,
    avg_operating_margin: 39.83,
  },
  per_year: [
    {
      year: 2024,
      operating_cashflow: 118548000000,
      capex: -44477000000,
      free_cashflow: 74071000000,
      fcf_per_share: 9.97,
      dividend_per_share: 3.00,
      fcf_yield: 2.41,
      dividend_yield: 0.72,
    },
    {
      year: 2025,
      operating_cashflow: 136162000000,
      capex: -64551000000,
      free_cashflow: 71611000000,
      fcf_per_share: 9.64,
      dividend_per_share: 3.32,
      fcf_yield: 2.09,
      dividend_yield: 0.72,
    },
  ],
}

import * as d3 from 'd3'

// ── Tests ─────────────────────────────────────────────────────

describe('CashflowPanel', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.restoreAllMocks())

  // ── Averages strip ────────────────────────────────────────

  it('renders the averages strip', () => {
    const w = mount(CashflowPanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="cashflow-averages"]').exists()).toBe(true)
  })

  it('shows all expected average labels', () => {
    const w = mount(CashflowPanel, { props: { data: FIXTURE } })
    const text = w.find('[data-testid="cashflow-averages"]').text()
    expect(text).toContain('Avg FCF Yield')
    expect(text).toContain('Avg Div. Yield')
    expect(text).toContain('Avg Op. Margin')
  })

  it('formats Avg FCF Yield as percentage (2.1%)', () => {
    const w = mount(CashflowPanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="cashflow-averages"]').text()).toContain('2.1%')
  })

  it('shows — for null ratios_summary values', () => {
    const data = { ...FIXTURE, ratios_summary: { avg_fcf_yield: null } }
    const w = mount(CashflowPanel, { props: { data } })
    expect(w.find('[data-testid="cashflow-averages"]').text()).toContain('—')
  })

  // ── Chart ─────────────────────────────────────────────────

  it('renders the chart container element', async () => {
    const w = mount(CashflowPanel, { props: { data: FIXTURE }, attachTo: document.body })
    await flushPromises()
    expect(w.find('[data-testid="cashflow-chart"]').exists()).toBe(true)
  })

  it('calls d3.select to draw the chart', async () => {
    mount(CashflowPanel, { props: { data: FIXTURE }, attachTo: document.body })
    await flushPromises()
    expect(d3.select).toHaveBeenCalled()
  })

  // ── Per-year table ────────────────────────────────────────

  it('renders the per-year table', () => {
    const w = mount(CashflowPanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="cashflow-table"]').exists()).toBe(true)
  })

  it('shows all expected row labels in the per-year table', () => {
    const w = mount(CashflowPanel, { props: { data: FIXTURE } })
    const text = w.find('[data-testid="cashflow-table"]').text()
    expect(text).toContain('Op. Cashflow')
    expect(text).toContain('CapEx')
    expect(text).toContain('Free Cashflow')
    expect(text).toContain('FCF/Share')
    expect(text).toContain('Div./Share')
    expect(text).toContain('FCF Yield')
    expect(text).toContain('Div. Yield')
  })

  it('shows years sorted descending (2025 before 2024)', () => {
    const w = mount(CashflowPanel, { props: { data: FIXTURE } })
    const headers = w.findAll('[data-testid="cashflow-table"] thead th')
    const years = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(years[0]).toBe('2025')
    expect(years[1]).toBe('2024')
  })

  it('formats operating cashflow as $118.5B for 2024', () => {
    const w = mount(CashflowPanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="cashflow-table"]').text()).toContain('$118.5B')
  })

  it('formats FCF/share as $9.97 for 2024', () => {
    const w = mount(CashflowPanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="cashflow-table"]').text()).toContain('$9.97')
  })

  it('formats FCF yield as percentage (2.4%) for 2024', () => {
    const w = mount(CashflowPanel, { props: { data: FIXTURE } })
    expect(w.find('[data-testid="cashflow-table"]').text()).toContain('2.4%')
  })

  it('marks negative CapEx cells with gmr-ann__neg class', () => {
    const w = mount(CashflowPanel, { props: { data: FIXTURE } })
    expect(w.findAll('.gmr-ann__neg').length).toBeGreaterThan(0)
  })

  it('displayYears=1 shows only the most recent year', () => {
    const w = mount(CashflowPanel, { props: { data: FIXTURE, displayYears: 1 } })
    const headers = w.findAll('[data-testid="cashflow-table"] thead th')
    const years = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(years).toHaveLength(1)
    expect(years[0]).toBe('2025')
  })

  it('shows — for null cashflow values', () => {
    const data = {
      ...FIXTURE,
      per_year: [{ year: 2025, operating_cashflow: null, free_cashflow: null }],
    }
    const w = mount(CashflowPanel, { props: { data } })
    expect(w.find('[data-testid="cashflow-table"]').text()).toContain('—')
  })

  it('year with only free_cashflow still appears (filter allows either field)', () => {
    const data = {
      ...FIXTURE,
      per_year: [{ year: 2025, operating_cashflow: null, free_cashflow: 50e9 }],
    }
    const w = mount(CashflowPanel, { props: { data } })
    const headers = w.findAll('[data-testid="cashflow-table"] thead th')
    const years = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(years).toContain('2025')
  })
})
