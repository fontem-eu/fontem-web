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

// ── Fundamentals fixture ──────────────────────────────────────
const FUND_FIXTURE = {
  ticker: 'MSFT',
  market_snapshot: {
    current_price: 400.48,
    market_cap: 2973816013936,
    shares_outstanding: 7425629076,
    avg_volume: 34225305,
    last_dividend_date: '2026-02-19',
    last_dividend_amount: 0.91,
  },
  ratios_summary: {
    avg_roe: 34.39,
    avg_roa: 14.79,
    avg_npm: 32.07,
    avg_gross_margin: 67.97,
    avg_operating_margin: 39.83,
    avg_current_ratio: 2.08,
    avg_quick_ratio: 1.89,
    avg_debt_to_equity: 1.45,
    avg_debt_to_assets: 0.57,
    avg_dividend_yield: 0,
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
      total_assets: 512163000000,
      total_liabilities: 243686000000,
      equity: 268477000000,
      current_assets: 159734000000,
      current_liabilities: 125286000000,
      operating_cashflow: -6817000000,
      capex: -44477000000,
      free_cashflow: 37660000000,
      roe: 32.83,
      npm: 35.96,
      gross_margin: 69.76,
      operating_margin: 44.64,
      current_ratio: 1.27,
      debt_to_equity: 0.91,
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
      total_assets: 619003000000,
      total_liabilities: 275524000000,
      equity: 343479000000,
      current_assets: 191131000000,
      current_liabilities: 141218000000,
      operating_cashflow: -2950000000,
      capex: -64551000000,
      free_cashflow: 61601000000,
      roe: 29.65,
      npm: 36.15,
      gross_margin: 68.82,
      operating_margin: 45.62,
      current_ratio: 1.35,
      debt_to_equity: 0.8,
      revenue_growth: 14.93,
      earnings_growth: 15.54,
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

  it('renders the ratios summary section', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()

    const ratios = wrapper.find('[data-testid="fund-ratios"]')
    expect(ratios.exists()).toBe(true)
    expect(ratios.text()).toContain('Avg ROE')
    expect(ratios.text()).toContain('Avg Net Margin')
    expect(ratios.text()).toContain('34.4%') // avg_roe: 34.39 → 34.4%
  })

  it('renders the per-year table with expected metrics', async () => {
    vi.spyOn(gmrApi, 'fetchFundamentals').mockResolvedValue(FUND_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT', view: 'fundamentals' } })
    await flushPromises()

    const table = wrapper.find('[data-testid="fund-annual-table"]')
    expect(table.exists()).toBe(true)
    expect(table.text()).toContain('Revenue')
    expect(table.text()).toContain('Net Income')
    expect(table.text()).toContain('Free Cashflow')
    expect(table.text()).toContain('Gross Margin')
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
