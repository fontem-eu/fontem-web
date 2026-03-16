import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TickerFinancials from '../../src/components/TickerFinancials.vue'
import * as gmrApi from '../../src/api/gmr.js'

// Minimal MSFT fixture
const MSFT_FIXTURE = {
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

describe('TickerFinancials component', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a loading state while the API call is in flight', () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockReturnValue(new Promise(() => {}))
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT' } })
    expect(wrapper.find('[data-testid="fin-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="snapshot-grid"]').exists()).toBe(false)
  })

  it('renders the snapshot grid with the current price', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(MSFT_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="snapshot-grid"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="snap-price"]').text()).toContain('$403.54')
  })

  it('renders the current equity in the snapshot', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(MSFT_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT' } })
    await flushPromises()

    // $390.9B
    expect(wrapper.find('[data-testid="snap-equity"]').text()).toContain('$390')
  })

  it('renders the annual table with revenue rows', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(MSFT_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT' } })
    await flushPromises()

    const table = wrapper.find('[data-testid="annual-table"]')
    expect(table.exists()).toBe(true)
    expect(table.text()).toContain('Revenue')
    expect(table.text()).toContain('Net Income')
    expect(table.text()).toContain('Cash from Ops')
  })

  it('displays both years as columns in the table', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(MSFT_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT' } })
    await flushPromises()

    const headers = wrapper.findAll('[data-testid="annual-table"] thead th')
    const headerTexts = headers.map(h => h.text())
    expect(headerTexts).toContain('2024')
    expect(headerTexts).toContain('2025')
  })

  it('formats billions correctly (245122000000 → $245.1B)', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(MSFT_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="annual-table"]').text()).toContain('$245.1B')
  })

  it('marks negative CapEx cells with gmr-ann__neg class', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(MSFT_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT' } })
    await flushPromises()

    const negCells = wrapper.findAll('.gmr-ann__neg')
    expect(negCells.length).toBeGreaterThan(0)
  })

  it('shows an error state when the API call fails', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockRejectedValue(new Error('network'))
    const wrapper = mount(TickerFinancials, { props: { symbol: 'FAIL' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="fin-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="snapshot-grid"]').exists()).toBe(false)
  })

  it('emits a close event when the × button is clicked', async () => {
    vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(MSFT_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT' } })
    await flushPromises()

    await wrapper.find('button[aria-label="Close financials"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('re-fetches when the symbol prop changes', async () => {
    const spy = vi.spyOn(gmrApi, 'fetchGmrData').mockResolvedValue(MSFT_FIXTURE)
    const wrapper = mount(TickerFinancials, { props: { symbol: 'MSFT' } })
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('MSFT')

    await wrapper.setProps({ symbol: 'AAPL' })
    await flushPromises()
    expect(spy).toHaveBeenCalledWith('AAPL')
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
