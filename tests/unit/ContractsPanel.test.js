import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ContractsPanel from '../../src/components/ContractsPanel.vue'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeContract(overrides = {}) {
  return {
    ted_notice_id: '123-2024',
    title: 'IT Services Contract',
    value_eur: 500000,
    award_date: '2024-06-15',
    cpv: '72000000 - IT services',
    procedure_type: 'open',
    ted_url: 'https://ted.europa.eu/en/notice/123-2024',
    authority: 'Ministry of Defence',
    authority_country: 'DE',
    ...overrides,
  }
}

function makeContractsResponse(overrides = {}) {
  return {
    gmr_id: 'abc-123',
    company_name: 'Test Corp',
    country: 'DE',
    total_contract_value_eur: 1000000,
    contract_count: 2,
    contracts: [
      makeContract(),
      makeContract({ ted_notice_id: '456-2024', title: 'Consulting', value_eur: 500000 }),
    ],
    ...overrides,
  }
}

describe('ContractsPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    const wrapper = mount(ContractsPanel, { props: { symbol: 'TEST.DE' } })
    expect(wrapper.text()).toContain('Loading')
  })

  it('shows contracts when API returns data (UUID symbol)', async () => {
    // UUID symbol — used directly as gmr_id, no ticker resolution needed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse(),
    })
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc' },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="contracts-summary"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="contracts-table"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('IT Services Contract')
    expect(wrapper.text()).toContain('2')  // contract count in summary
    expect(wrapper.text()).toContain('DE')  // country in summary
  })

  it('shows empty state when company has no contracts', async () => {
    // First call: resolve ticker → gmr_id
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ gmr_id: 'gid-1' }] }),
    })
    // Second call: contracts returns empty
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse({ contract_count: 0, contracts: [] }),
    })
    const wrapper = mount(ContractsPanel, { props: { symbol: 'AAPL' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="contracts-empty"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No EU public procurement data')
  })

  it('shows error state on API failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc' },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="contracts-error"]').exists()).toBe(true)
  })

  it('shows empty state when ticker cannot be resolved', async () => {
    // Ticker search returns no results
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    })
    const wrapper = mount(ContractsPanel, { props: { symbol: 'UNKNOWN' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="contracts-empty"]').exists()).toBe(true)
  })

  it('renders TED links in the contracts table', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse(),
    })
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc' },
    })
    await flushPromises()

    const link = wrapper.find('a[href*="ted.europa.eu"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('target')).toBe('_blank')
  })

  it('sorts by value descending by default', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse({
        contracts: [
          makeContract({ ted_notice_id: 'a', value_eur: 100 }),
          makeContract({ ted_notice_id: 'b', value_eur: 900 }),
        ],
      }),
    })
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc' },
    })
    await flushPromises()

    const rows = wrapper.findAll('tbody tr')
    // Default sort is value_eur descending — 900 should be first
    expect(rows[0].text()).toContain('900')
  })
})
