import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ValuationPanel from '../../src/components/ValuationPanel.vue'

const FIXTURE = {
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

describe('ValuationPanel', () => {
  it('renders the valuation snapshot section', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    expect(wrapper.find('[data-testid="val-snapshot"]').exists()).toBe(true)
  })

  it('formats enterprise value correctly ($3.1T)', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    expect(wrapper.find('[data-testid="val-ev"]').text()).toContain('$3.1T')
  })

  it('formats market cap correctly ($3.0T)', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    expect(wrapper.find('[data-testid="val-mcap"]').text()).toContain('$3.0T')
  })

  it('formats EV/EBITDA as a ratio (21.70x)', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    expect(wrapper.find('[data-testid="val-ev-ebitda"]').text()).toContain('21.70x')
  })

  it('formats EV/Revenue correctly', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    expect(wrapper.find('[data-testid="val-ev-rev"]').text()).toContain('11.00x')
  })

  it('formats EV/FCF correctly', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    expect(wrapper.find('[data-testid="val-ev-fcf"]').text()).toContain('43.20x')
  })

  it('formats EV/EBIT correctly', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    expect(wrapper.find('[data-testid="val-ev-ebit"]').text()).toContain('24.10x')
  })

  it('renders the summary averages section', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    const summary = wrapper.find('[data-testid="val-summary"]')
    expect(summary.exists()).toBe(true)
    expect(summary.text()).toContain('Avg EBITDA Margin')
    expect(summary.text()).toContain('Avg ROIC')
    expect(summary.text()).toContain('Avg Interest Coverage')
    expect(summary.text()).toContain('Avg Net Debt / EBITDA')
  })

  it('formats EBITDA margin as percentage (48.5%)', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    expect(wrapper.find('[data-testid="val-summary"]').text()).toContain('48.5%')
  })

  it('formats ROIC as percentage (28.3%)', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    expect(wrapper.find('[data-testid="val-summary"]').text()).toContain('28.3%')
  })

  it('renders the per-year table', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    const table = wrapper.find('[data-testid="val-annual-table"]')
    expect(table.exists()).toBe(true)
  })

  it('shows both years as columns in the per-year table', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    const headers = wrapper.findAll('[data-testid="val-annual-table"] thead th')
    const texts = headers.map((h) => h.text())
    expect(texts).toContain('2024')
    expect(texts).toContain('2025')
  })

  it('shows all expected row metrics in the per-year table', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    const table = wrapper.find('[data-testid="val-annual-table"]')
    expect(table.text()).toContain('D&A')
    expect(table.text()).toContain('EBITDA')
    expect(table.text()).toContain('EBITDA Margin')
    expect(table.text()).toContain('Net Debt')
    expect(table.text()).toContain('Net Debt / EBITDA')
    expect(table.text()).toContain('Interest Coverage')
    expect(table.text()).toContain('ROIC')
    expect(table.text()).toContain('NOPAT')
    expect(table.text()).toContain('Invested Capital')
  })

  it('formats EBITDA in the per-year table as $151.0B', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    expect(wrapper.find('[data-testid="val-annual-table"]').text()).toContain('$151.0B')
  })

  it('formats ROIC in the per-year table as percentage', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    expect(wrapper.find('[data-testid="val-annual-table"]').text()).toContain('30.3%')
  })

  it('formats interest coverage as ratio (42.80x)', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    expect(wrapper.find('[data-testid="val-annual-table"]').text()).toContain('42.80x')
  })

  it('shows years sorted ascending in per-year table (2024 before 2025)', () => {
    const wrapper = mount(ValuationPanel, { props: { data: FIXTURE } })
    const headers = wrapper.findAll('[data-testid="val-annual-table"] thead th')
    const yearHeaders = headers.map((h) => h.text()).filter((t) => /^\d{4}$/.test(t))
    expect(yearHeaders[0]).toBe('2024')
    expect(yearHeaders[1]).toBe('2025')
  })

  it('handles null snapshot values gracefully (shows —)', () => {
    const data = {
      ...FIXTURE,
      valuation_snapshot: { enterprise_value: null, ev_ebitda: null },
    }
    const wrapper = mount(ValuationPanel, { props: { data } })
    const snap = wrapper.find('[data-testid="val-snapshot"]')
    expect(snap.text()).toContain('—')
  })
})
