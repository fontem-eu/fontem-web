import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount as vueMount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
import ContractsPanel from '../../src/components/ContractsPanel.vue'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// The counterparty cell now renders a <RouterLink> when the row carries
// the linkable id (`authority_id` for company-view contracts,
// `contractor_gmr_id` for authority-view contracts). Install a memory
// router on every mount so those links resolve without a real DOM
// router.
function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/c/:id/profile', component: { template: '<div data-testid="profile-stub" />' } },
      { path: '/contract/:noticeId', component: { template: '<div data-testid="contract-detail-stub" />' } },
    ],
  })
}

function mount(Component, opts = {}) {
  const router = makeRouter()
  return vueMount(Component, {
    ...opts,
    global: {
      ...(opts.global || {}),
      plugins: [...((opts.global && opts.global.plugins) || [makeTestI18n()]), router],
    },
  })
}

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
    authority_id: 'auth-min-def',
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

function makeAuthorityResponse() {
  // Authority endpoint: `authority_name` at top-level; per-row contractor
  // fields instead of authority fields. ContractsPanel normalises the
  // top-level keys but leaves the row shape untouched.
  return {
    authority_id: 'auth-X',
    authority_name: 'Ministry of X',
    country: 'DE',
    contract_count: 1,
    total_spend_eur: 100000,
    contracts: [
      {
        ted_notice_id: '789-2024',
        title: 'Bus purchase',
        value_eur: 100000,
        award_date: '2024-04-21',
        cpv: '34000000',
        procedure_type: null,
        ted_url: null,
        contractor: 'BusCo Ltd.',
        contractor_country: 'DE',
        contractor_gmr_id: 'company-busco',
      },
    ],
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
    // Second call: company contracts returns empty
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse({ contract_count: 0, contracts: [] }),
    })
    // Third call: authority fallback also empty
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authority_name: null, country: null, contract_count: 0, contracts: [] }),
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

  it('links each contract title to our detail page (not TED)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse({
        contracts: [makeContract({ ted_notice_id: '123-2024' })],
      }),
    })
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc' },
    })
    await flushPromises()
    const link = wrapper.find('[data-testid="contract-title-link-123-2024"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/contract/123-2024')
  })

  it('links the details column to our detail page', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse({
        contracts: [makeContract({ ted_notice_id: '123-2024' })],
      }),
    })
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc' },
    })
    await flushPromises()
    const link = wrapper.find('[data-testid="contract-details-link-123-2024"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/contract/123-2024')
  })

  it('no longer links contracts straight out to TED', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse(),
    })
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc' },
    })
    await flushPromises()
    // Contracts now route through our detail page; the outward TED link
    // lives there, not in the table.
    expect(wrapper.find('a[href*="ted.europa.eu"]').exists()).toBe(false)
    expect(wrapper.find('a[href*="/ted-link"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid^="contract-ted-link-"]').exists()).toBe(false)
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

  // Regression: authority contracts should load via authority endpoint
  it('loads contracts for an authority when company endpoint returns empty', async () => {
    // UUID symbol — company endpoint returns 0 contracts
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse({ contract_count: 0, contracts: [] }),
    })
    // Authority endpoint returns contracts
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authority_id: 'auth-123',
        authority_name: 'Metro Mondego, S. A.',
        country: 'PRT',
        contract_count: 3,
        total_spend_eur: 1500000,
        contracts: [
          makeContract({ title: 'Bus purchase', value_eur: 1000000 }),
          makeContract({ ted_notice_id: '456', title: 'Consulting', value_eur: 300000 }),
          makeContract({ ted_notice_id: '789', title: 'Maintenance', value_eur: 200000 }),
        ],
      }),
    })
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc' },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="contracts-empty"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Bus purchase')
    expect(wrapper.text()).toContain('3') // contract count
  })

  // ── Counterparty cell: profile links ──────────────────────────
  // Inside a company profile, each contract row's awarding authority
  // should link to that authority's profile page. Inside an authority
  // profile, each row's contractor should link to that company's
  // profile page. Without these the user has no way to dig into the
  // other side of any contract.

  it('links each authority cell to /c/<authority_id>/profile in company view', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse({
        contracts: [
          makeContract({ ted_notice_id: 'r1', authority: 'Ministry of X', authority_id: 'auth-x' }),
          makeContract({ ted_notice_id: 'r2', authority: 'City of Y',     authority_id: 'auth-y' }),
        ],
      }),
    })
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc' },
    })
    await flushPromises()

    const linkX = wrapper.find('[data-testid="contract-counterparty-link-r1"]')
    const linkY = wrapper.find('[data-testid="contract-counterparty-link-r2"]')
    expect(linkX.exists()).toBe(true)
    expect(linkX.attributes('href')).toBe('/c/auth-x/profile')
    expect(linkX.text()).toContain('Ministry of X')
    expect(linkY.attributes('href')).toBe('/c/auth-y/profile')
  })

  it('links each contractor cell to /c/<contractor_gmr_id>/profile in authority view', async () => {
    // Company endpoint returns 0 → falls back to authority endpoint.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse({ contract_count: 0, contracts: [] }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeAuthorityResponse(),
    })
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc' },
    })
    await flushPromises()

    const link = wrapper.find('[data-testid="contract-counterparty-link-789-2024"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/c/company-busco/profile')
    expect(link.text()).toContain('BusCo Ltd.')
  })

  it('relabels the counterparty column from "Authority" to "Contractor" when rendering an authority profile', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse({ contract_count: 0, contracts: [] }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeAuthorityResponse(),
    })
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc' },
    })
    await flushPromises()

    const headers = wrapper.findAll('thead th').map((th) => th.text())
    expect(headers.some((h) => h.startsWith('Contractor'))).toBe(true)
    expect(headers.some((h) => h.startsWith('Authority'))).toBe(false)
  })

  // ── entityKind prop (batch-5 item 4) ──────────────────────────
  // When the parent already knows the entity is an authority, the
  // counterparty header should say "Contractor" even before contracts
  // load (or in races where row-shape detection hasn't kicked in yet).
  // Symmetrically, an explicit 'company' prop pins the header to
  // "Authority" even if some row happens to carry contractor_gmr_id.

  it('renders Contractor header immediately when entityKind="authority" is passed', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeAuthorityResponse(),
    })
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc', entityKind: 'authority' },
    })
    await flushPromises()
    const headers = wrapper.findAll('thead th').map((th) => th.text())
    expect(headers.some((h) => h.startsWith('Contractor'))).toBe(true)
    expect(headers.some((h) => h.startsWith('Authority'))).toBe(false)
  })

  it('renders Authority header when entityKind="company" pins it, even if a row has contractor_gmr_id', async () => {
    // Synthetic row that mixes shapes — should never happen in
    // production but proves the prop wins over the row-shape sniff.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse({
        contracts: [
          { ...makeContract({ ted_notice_id: 'r1' }), contractor_gmr_id: 'co-x' },
        ],
      }),
    })
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc', entityKind: 'company' },
    })
    await flushPromises()
    const headers = wrapper.findAll('thead th').map((th) => th.text())
    expect(headers.some((h) => h.startsWith('Authority'))).toBe(true)
    expect(headers.some((h) => h.startsWith('Contractor'))).toBe(false)
  })

  it('without an entityKind prop, falls back to row-shape detection (unchanged)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse({ contract_count: 0, contracts: [] }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeAuthorityResponse(),
    })
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc' },  // no entityKind
    })
    await flushPromises()
    const headers = wrapper.findAll('thead th').map((th) => th.text())
    expect(headers.some((h) => h.startsWith('Contractor'))).toBe(true)
  })

  it('falls back to plain text when the row carries no linkable id', async () => {
    // Pre-rename rows (no authority_id, no contractor_gmr_id) must
    // still render — without a link, but without breaking the column.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeContractsResponse({
        contracts: [
          { ...makeContract({ ted_notice_id: 'r1' }), authority_id: null },
        ],
      }),
    })
    const wrapper = mount(ContractsPanel, {
      props: { symbol: 'abc12345-1234-1234-1234-123456789abc' },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="contract-counterparty-link-r1"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Ministry of Defence')
  })
})
