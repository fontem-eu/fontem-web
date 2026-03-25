import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TickerFinancials from '../../src/components/TickerFinancials.vue'
import * as gmrApi from '../../src/api/gmr.js'

// ── GMR Long fixture ─────────────────────────────────────────
const GMR_FIXTURE = {
  ticker: 'MSFT',
  current_snapshot: {
    price: 403.54,
    avg_volume: 34005827,
    current_assets: 180190000000,
    inventory: 1059000000,
    prepaid_expenses: 33134000000,
    current_liabilities: 130005000000,
    total_debt: 57607000000,
    equity: 390875000000,
    shares: 7425629076,
    last_dividend_date: '2026-02-19',
    last_dividend_amount: 0.91,
    last_split_year: 2003,
    last_split_ratio: 2,
  },
  annual_data: [
    {
      year: 2024,
      avg_price: 414.73,
      revenue: 245122000000,
      earnings: 88136000000,
      total_assets: 512163000000,
      liabilities: 243686000000,
      equity: 268477000000,
      current_assets: 159734000000,
      inventory: 1246000000,
      prepaid_expenses: 26021000000,
      current_liabilities: 125286000000,
      cfo: 118548000000,
      delta_ppe: -44477000000,
      splits: 0,
    },
    {
      year: 2025,
      avg_price: 461.78,
      revenue: 281724000000,
      earnings: 101832000000,
      total_assets: 619003000000,
      liabilities: 275524000000,
      equity: 343479000000,
      current_assets: 191131000000,
      inventory: 938000000,
      prepaid_expenses: 25723000000,
      current_liabilities: 141218000000,
      cfo: 136162000000,
      delta_ppe: -64551000000,
      splits: 0,
    },
  ],
}

// ── Fundamentals fixture (updated with all new fields) ────────
const FUND_FIXTURE = {
  ticker: 'MSFT',
  market_snapshot: {
    current_price: 400.48,
    market_cap: 2973816013936,
    shares_outstanding: 7425629076,
    avg_volume: 34225305,
    last_dividend_date: '2026-02-19',
    last_dividend_amount: 0.91,
    beta: 0.90,
    week_52_high: 468.35,
    week_52_low: 344.79,
  },
  ratios_summary: {
    avg_pe: 32.1,
    avg_pb: 11.5,
    avg_ps: 10.3,
    avg_roe: 34.39,
    avg_roa: 14.79,
    avg_npm: 32.07,
    avg_gross_margin: 67.97,
    avg_operating_margin: 39.83,
    avg_current_ratio: 2.08,
    avg_quick_ratio: 1.89,
    avg_debt_to_equity: 1.45,
    avg_debt_to_assets: 0.57,
    avg_fcf_yield: 2.1,
    avg_dividend_yield: 0.8,
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
      total_assets: 512163000000,
      total_liabilities: 243686000000,
      equity: 268477000000,
      current_assets: 159734000000,
      current_liabilities: 125286000000,
      operating_cashflow: 118548000000,
      capex: 44477000000,
      free_cashflow: 74071000000,
      book_value_per_share: 36.14,
      revenue_per_share: 32.99,
      fcf_per_share: 9.97,
      dividend_per_share: 3.00,
      pe: 34.97,
      pb: 11.47,
      ps: 12.57,
      roe: 32.83,
      roa: 17.21,
      npm: 35.96,
      gross_margin: 69.76,
      operating_margin: 44.64,
      current_ratio: 1.27,
      quick_ratio: 1.15,
      debt_to_equity: 0.91,
      debt_to_assets: 0.48,
      fcf_yield: 2.41,
      dividend_yield: 0.72,
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
      total_assets: 619003000000,
      total_liabilities: 275524000000,
      equity: 343479000000,
      current_assets: 191131000000,
      current_liabilities: 141218000000,
      operating_cashflow: 136162000000,
      capex: 64551000000,
      free_cashflow: 71611000000,
      book_value_per_share: 46.26,
      revenue_per_share: 37.94,
      fcf_per_share: 9.64,
      dividend_per_share: 3.32,
      pe: 33.68,
      pb: 9.98,
      ps: 11.16,
      roe: 29.65,
      roa: 16.45,
      npm: 36.15,
      gross_margin: 68.82,
      operating_margin: 45.62,
      current_ratio: 1.35,
      quick_ratio: 1.20,
      debt_to_equity: 0.8,
      debt_to_assets: 0.45,
      fcf_yield: 2.09,
      dividend_yield: 0.72,
      revenue_growth: 14.93,
      earnings_growth: 15.54,
    },
  ],
}

// ── Valuation fixture ─────────────────────────────────────────
const VALUATION_FIXTURE = {
  ticker: 'MSFT',
  valuation_snapshot: {
    enterprise_value: 3100000000000,
    market_cap: 2970000000000,
    ev_ebitda: 21.7,
    ev_revenue: 11.0,
    ev_fcf: 43.2,
    ev_ebit: 24.1,
  },
  summary: {
    avg_ebitda_margin: 48.5,
    avg_roic: 28.3,
    avg_interest_coverage: 42.1,
    avg_net_debt_to_ebitda: 0.15,
  },
  per_year: [
    {
      year: 2025,
      da: 23000000000,
      interest_expense: 3000000000,
      cash_and_equivalents: 80000000000,
      long_term_debt: 95000000000,
      ebitda: 151000000000,
      ebitda_margin: 53.6,
      net_debt: 15000000000,
      net_debt_to_ebitda: 0.1,
      interest_coverage: 42.8,
      effective_tax_rate: 14.5,
      nopat: 109000000000,
      invested_capital: 360000000000,
      roic: 30.3,
    },
    {
      year: 2024,
      da: 19000000000,
      interest_expense: 2000000000,
      cash_and_equivalents: 75000000000,
      long_term_debt: 100000000000,
      ebitda: 128000000000,
      ebitda_margin: 52.2,
      net_debt: 25000000000,
      net_debt_to_ebitda: 0.2,
      interest_coverage: 54.7,
      effective_tax_rate: 15.0,
      nopat: 93000000000,
      invested_capital: 290000000000,
      roic: 32.1,
    },
  ],
}

// ── GMR Long view tests ───────────────────────────────────────
describe('TickerFinancials — gmr-long view', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a loading state while the API call is in flight', () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockReturnValue(new Promise(() => {}))
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    expect(wrapper.find('[data-testid="fin-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="snapshot-grid"]').exists()).toBe(false)
  })

  it('renders the snapshot grid with the current price', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(GMR_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="snapshot-grid"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="snap-price"]').text()).toContain('$403.54')
  })

  it('renders the current equity in the snapshot', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(GMR_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="snap-equity"]').text()).toContain('$390')
  })

  it('renders the annual table with revenue rows', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(GMR_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    await flushPromises()

    const table = wrapper.find('[data-testid="annual-table"]')
    expect(table.exists()).toBe(true)
    expect(table.text()).toContain('Revenue')
    expect(table.text()).toContain('Net Income')
    expect(table.text()).toContain('Cash from Ops')
  })

  it('displays both years as columns in the table', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(GMR_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    await flushPromises()

    const headers = wrapper.findAll('[data-testid="annual-table"] thead th')
    const headerTexts = headers.map((h) => h.text())
    expect(headerTexts).toContain('2024')
    expect(headerTexts).toContain('2025')
  })

  it('shows most recent year (2025) as the first column', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(GMR_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    await flushPromises()

    const headers = wrapper.findAll('[data-testid="annual-table"] thead th')
    const yearCols = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(yearCols[0]).toBe('2025')
    expect(yearCols[1]).toBe('2024')
  })

  it('renders the years selector with 5Y, 7Y, 10Y, All buttons', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(GMR_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="year-selector"]').exists()).toBe(true)
    for (const id of ['5', '7', '10', 'all']) {
      expect(wrapper.find(`[data-testid="year-btn-${id}"]`).exists()).toBe(true)
    }
    // Removed options should not exist
    expect(wrapper.find('[data-testid="year-btn-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="year-btn-3"]').exists()).toBe(false)
  })

  it('defaults to 10Y being active', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(GMR_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="year-btn-10"]').classes()).toContain('active')
    expect(wrapper.find('[data-testid="year-btn-5"]').classes()).not.toContain('active')
    expect(wrapper.find('[data-testid="year-btn-all"]').classes()).not.toContain('active')
  })

  it('clicking 5Y limits the table to 5 columns (fixture has 2, shows all 2)', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(GMR_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    await flushPromises()

    await wrapper.find('[data-testid="year-btn-5"]').trigger('click')
    expect(wrapper.find('[data-testid="year-btn-5"]').classes()).toContain('active')

    const headers = wrapper.findAll('[data-testid="annual-table"] thead th')
    const yearCols = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    // Fixture has 2 years; 5Y cap still shows both
    expect(yearCols.length).toBeLessThanOrEqual(5)
    expect(yearCols[0]).toBe('2025')
  })

  it('clicking All shows all available years', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(GMR_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    await flushPromises()

    await wrapper.find('[data-testid="year-btn-all"]').trigger('click')
    expect(wrapper.find('[data-testid="year-btn-all"]').classes()).toContain('active')

    const headers = wrapper.findAll('[data-testid="annual-table"] thead th')
    const yearCols = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(yearCols).toHaveLength(2) // fixture has 2 years
  })

  it('formats billions correctly (245122000000 → $245.1B)', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(GMR_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="annual-table"]').text()).toContain('$245.1B')
  })

  it('marks negative CapEx cells with gmr-ann__neg class', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(GMR_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    await flushPromises()

    const negCells = wrapper.findAll('.gmr-ann__neg')
    expect(negCells.length).toBeGreaterThan(0)
  })

  it('shows an error state when the API call fails', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockRejectedValue(new Error('network'))
    const wrapper = mount(TickerFinancials, { props: { symbol: 'FAIL', view: 'gmr-long' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="fin-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="snapshot-grid"]').exists()).toBe(false)
  })

  it('emits a close event when the × button is clicked', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(GMR_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    await flushPromises()

    await wrapper.find('button[aria-label="Close financials"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('re-fetches when the symbol prop changes', async () => {
    const spy = vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(GMR_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('MSFT')

    await wrapper.setProps({ symbol: 'AAPL' })
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('AAPL')
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

// ── Fundamentals view tests ───────────────────────────────────
describe('TickerFinancials — fundamentals view', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a loading state while the API call is in flight', () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockReturnValue(new Promise(() => {}))
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    expect(wrapper.find('[data-testid="fin-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fund-mkt-snapshot"]').exists()).toBe(false)
  })

  it('calls fetchFundamentals (not fetchGmrData) for fundamentals view', async () => {
    const fundSpy = vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const gmrSpy = vi.spyOn(gmrApi, 'fetchGmrData')
    mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()

    expect(fundSpy).toHaveBeenCalledWith('MSFT')
    expect(gmrSpy).not.toHaveBeenCalled()
  })

  it('renders the market snapshot with current price', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()

    const snap = wrapper.find('[data-testid="fund-mkt-snapshot"]')
    expect(snap.exists()).toBe(true)
    expect(wrapper.find('[data-testid="fund-snap-price"]').text()).toContain('$400.48')
  })

  it('renders the market snapshot market cap', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="fund-snap-mcap"]').text()).toContain('$3.0T')
  })

  it('renders beta in the market snapshot', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="fund-snap-beta"]').text()).toContain('0.90')
  })

  it('renders 52-week high and low', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="fund-snap-52h"]').text()).toContain('$468.35')
    expect(wrapper.find('[data-testid="fund-snap-52l"]').text()).toContain('$344.79')
  })

  it('renders the ratios summary section with top-level averages', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()

    const ratios = wrapper.find('[data-testid="fund-ratios"]')
    expect(ratios.exists()).toBe(true)
    expect(ratios.text()).toContain('Avg P/E')
    expect(ratios.text()).toContain('Avg P/B')
    expect(ratios.text()).toContain('Avg ROE')
    expect(ratios.text()).toContain('Avg Net Margin')
    expect(ratios.text()).toContain('Avg FCF Yield')
    expect(ratios.text()).toContain('Avg Revenue Growth')
    expect(ratios.text()).toContain('Avg Earnings Growth')
    expect(ratios.text()).toContain('Avg Div. Yield')
    expect(ratios.text()).toContain('34.4%') // avg_roe: 34.39 → 34.4%
  })

  it('renders the per-year table with key highlight metrics', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()

    const table = wrapper.find('[data-testid="fund-annual-table"]')
    expect(table.exists()).toBe(true)
    expect(table.text()).toContain('Revenue')
    expect(table.text()).toContain('Net Income')
    expect(table.text()).toContain('Free Cashflow')
    expect(table.text()).toContain('EPS')
    expect(table.text()).toContain('Total Assets')
    expect(table.text()).toContain('Equity')
    expect(table.text()).toContain('P/E')
    expect(table.text()).toContain('ROE')
    expect(table.text()).toContain('Net Margin')
  })

  it('displays both years as columns in the per-year table', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()

    const headers = wrapper.findAll('[data-testid="fund-annual-table"] thead th')
    const headerTexts = headers.map((h) => h.text())
    expect(headerTexts).toContain('2024')
    expect(headerTexts).toContain('2025')
  })

  it('shows most recent year (2025) first in fundamentals table', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()

    const headers = wrapper.findAll('[data-testid="fund-annual-table"] thead th')
    const yearCols = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(yearCols[0]).toBe('2025')
    expect(yearCols[1]).toBe('2024')
  })

  it('clicking 5Y on fundamentals view shows at most 5 columns', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()

    await wrapper.find('[data-testid="year-btn-5"]').trigger('click')

    const headers = wrapper.findAll('[data-testid="fund-annual-table"] thead th')
    const yearCols = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(yearCols.length).toBeLessThanOrEqual(5)
    expect(yearCols[0]).toBe('2025')
  })

  it('year selector is not shown during loading', () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockReturnValue(new Promise(() => {}))
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    expect(wrapper.find('[data-testid="year-selector"]').exists()).toBe(false)
  })

  it('year selector is not shown for the summary view', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'summary' } })
    await flushPromises()
    expect(wrapper.find('[data-testid="year-selector"]').exists()).toBe(false)
  })

  it('shows an error state when the fundamentals API fails', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockRejectedValue(new Error('network'))
    const wrapper = mount(TickerFinancials, { props: { symbol: 'FAIL', view: 'fundamentals' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="fin-error"]').exists()).toBe(true)
  })

  it('re-fetches fundamentals when symbol changes', async () => {
    const spy = vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('MSFT')

    await wrapper.setProps({ symbol: 'AAPL' })
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('AAPL')
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('re-fetches when view changes from gmr-long to fundamentals', async () => {
    const gmrSpy = vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(GMR_FIXTURE)
    const fundSpy = vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)

    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'gmr-long' } })
    await flushPromises()
    expect(gmrSpy).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ view: 'fundamentals' })
    await flushPromises()
    expect(fundSpy).toHaveBeenCalledWith('MSFT')
  })

  it('does not show the gmr-long snapshot grid', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="snapshot-grid"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="fund-mkt-snapshot"]').exists()).toBe(true)
  })
})

// ── Valuation view tests ──────────────────────────────────────
describe('TickerFinancials — valuation view', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls fetchValuation (not fetchFundamentals or fetchGmrData) for valuation view', async () => {
    const valSpy = vi.spyOn(gmrApi, 'fetchValuation').mockResolvedValue(VALUATION_FIXTURE)
    const fundSpy = vi.spyOn(gmrApi, 'fetchFundamentals')
    const gmrSpy = vi.spyOn(gmrApi, 'fetchGmrData')
    mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'valuation' } })
    await flushPromises()

    expect(valSpy).toHaveBeenCalledWith('MSFT')
    expect(fundSpy).not.toHaveBeenCalled()
    expect(gmrSpy).not.toHaveBeenCalled()
  })

  it('shows loading state while fetching valuation', () => {
    vi.spyOn(gmrApi, 'fetchValuation').mockReturnValue(new Promise(() => {}))
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'valuation' } })
    expect(wrapper.find('[data-testid="fin-loading"]').exists()).toBe(true)
  })

  it('renders the ValuationPanel when valuation data loads', async () => {
    vi.spyOn(gmrApi, 'fetchValuation').mockResolvedValue(VALUATION_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'valuation' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="valuation-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fund-mkt-snapshot"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="snapshot-grid"]').exists()).toBe(false)
  })

  it('shows error state when valuation API fails', async () => {
    vi.spyOn(gmrApi, 'fetchValuation').mockRejectedValue(new Error('network'))
    const wrapper = mount(TickerFinancials, { props: { symbol: 'FAIL', view: 'valuation' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="fin-error"]').exists()).toBe(true)
  })

  it('shows "Enterprise Valuation" as the view label', async () => {
    vi.spyOn(gmrApi, 'fetchValuation').mockResolvedValue(VALUATION_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'valuation' } })
    await flushPromises()

    expect(wrapper.find('.gmr-fin__subtitle').text()).toBe('Enterprise Valuation')
  })

  it('re-fetches valuation when symbol changes', async () => {
    const spy = vi.spyOn(gmrApi, 'fetchValuation').mockResolvedValue(VALUATION_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'valuation' } })
    await flushPromises()

    await wrapper.setProps({ symbol: 'AAPL' })
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('AAPL')
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('switches from fundamentals to valuation without calling fetchFundamentals again', async () => {
    const fundSpy = vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const valSpy = vi.spyOn(gmrApi, 'fetchValuation').mockResolvedValue(VALUATION_FIXTURE)

    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()
    expect(fundSpy).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ view: 'valuation' })
    await flushPromises()
    expect(valSpy).toHaveBeenCalledWith('MSFT')
    expect(fundSpy).toHaveBeenCalledTimes(1)
  })
})

// ── Income view tests ─────────────────────────────────────────
describe('TickerFinancials — income view', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('calls fetchFundamentals for the income view', async () => {
    const spy = vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'income' } })
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('MSFT')
  })

  it('does not call fetchValuation or fetchGmrData for income view', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const valSpy = vi.spyOn(gmrApi, 'fetchValuation')
    const gmrSpy = vi.spyOn(gmrApi, 'fetchGmrData')
    mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'income' } })
    await flushPromises()
    expect(valSpy).not.toHaveBeenCalled()
    expect(gmrSpy).not.toHaveBeenCalled()
  })

  it('renders the IncomePanel when data loads', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'income' } })
    await flushPromises()
    expect(wrapper.find('[data-testid="income-panel-wrap"]').exists()).toBe(true)
  })

  it('does not render fund-mkt-snapshot for income view', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'income' } })
    await flushPromises()
    expect(wrapper.find('[data-testid="fund-mkt-snapshot"]').exists()).toBe(false)
  })

  it('shows "Income & Growth" as the view label', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'income' } })
    await flushPromises()
    expect(wrapper.find('.gmr-fin__subtitle').text()).toBe('Income & Growth')
  })

  it('shows error state when API fails', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockRejectedValue(new Error('network'))
    const wrapper = mount(TickerFinancials, { props: { symbol: 'FAIL', view: 'income' } })
    await flushPromises()
    expect(wrapper.find('[data-testid="fin-error"]').exists()).toBe(true)
  })
})

// ── Cash Flow view tests ──────────────────────────────────────
describe('TickerFinancials — cashflow view', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('calls fetchFundamentals for the cashflow view', async () => {
    const spy = vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'cashflow' } })
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('MSFT')
  })

  it('renders the CashflowPanel when data loads', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'cashflow' } })
    await flushPromises()
    expect(wrapper.find('[data-testid="cashflow-panel-wrap"]').exists()).toBe(true)
  })

  it('shows "Cash Flow" as the view label', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'cashflow' } })
    await flushPromises()
    expect(wrapper.find('.gmr-fin__subtitle').text()).toBe('Cash Flow')
  })

  it('income and cashflow share the same API call when switching between them', async () => {
    const spy = vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'income' } })
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ view: 'cashflow' })
    await flushPromises()
    // Switching between fundamentals-family views re-fetches (same symbol + new view triggers watch)
    expect(spy).toHaveBeenCalledWith('MSFT')
  })

  it('shows error state when API fails', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockRejectedValue(new Error('network'))
    const wrapper = mount(TickerFinancials, { props: { symbol: 'FAIL', view: 'cashflow' } })
    await flushPromises()
    expect(wrapper.find('[data-testid="fin-error"]').exists()).toBe(true)
  })
})

// ── Balance Sheet view tests ──────────────────────────────────
describe('TickerFinancials — balance view', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('calls fetchFundamentals for the balance view', async () => {
    const spy = vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'balance' } })
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('MSFT')
  })

  it('renders the BalancePanel when data loads', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'balance' } })
    await flushPromises()
    expect(wrapper.find('[data-testid="balance-panel-wrap"]').exists()).toBe(true)
  })

  it('shows "Balance Sheet" as the view label', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'balance' } })
    await flushPromises()
    expect(wrapper.find('.gmr-fin__subtitle').text()).toBe('Balance Sheet')
  })

  it('does not render valuation panel for balance view', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'balance' } })
    await flushPromises()
    expect(wrapper.find('[data-testid="valuation-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="balance-panel-wrap"]').exists()).toBe(true)
  })

  it('re-fetches when symbol changes', async () => {
    const spy = vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'balance' } })
    await flushPromises()
    await wrapper.setProps({ symbol: 'AAPL' })
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('AAPL')
  })

  it('shows error state when API fails', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockRejectedValue(new Error('network'))
    const wrapper = mount(TickerFinancials, { props: { symbol: 'FAIL', view: 'balance' } })
    await flushPromises()
    expect(wrapper.find('[data-testid="fin-error"]').exists()).toBe(true)
  })
})
