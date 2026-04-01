import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import GraphExplorer from '../../src/components/GraphExplorer.vue'

// Mock cytoscape — jsdom has no canvas
const mockCy = {
  destroy: vi.fn(),
  on: vi.fn(),
  nodes: vi.fn(() => ({
    forEach: vi.fn(),
  })),
}
vi.mock('cytoscape', () => ({
  default: vi.fn(() => mockCy),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeGraphResponse(overrides = {}) {
  return {
    center: { id: 'comp-aaa', label: 'Acme Corp', type: 'Company', properties: {} },
    nodes: [
      { id: 'comp-aaa', label: 'Acme Corp', type: 'Company', properties: {} },
      { id: 'con-111', label: 'Road works', type: 'Contract', properties: { value_eur: 500000 } },
      { id: 'auth-xxx', label: 'Ville de Paris', type: 'Authority', properties: { country: 'FRA' } },
    ],
    edges: [
      { source: 'con-111', target: 'comp-aaa', type: 'AWARDED_TO', properties: {} },
      { source: 'auth-xxx', target: 'con-111', type: 'AWARDED', properties: {} },
    ],
    truncated: false,
    total_available: 3,
    ...overrides,
  }
}

function mountExplorer(props = {}) {
  return mount(GraphExplorer, {
    props: { entityId: 'comp-aaa', ...props },
    attachTo: document.body,
  })
}

describe('GraphExplorer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // GE-UI-01: Renders canvas
  it('renders the graph canvas element', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()
    expect(wrapper.find('[data-testid="ge-canvas"]').exists()).toBe(true)
  })

  // GE-UI-02: Depth slider triggers re-fetch
  it('re-fetches when depth slider changes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Change depth
    await wrapper.find('[data-testid="ge-depth-slider"]').setValue(2)
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1][0]).toContain('depth=2')
  })

  // GE-UI-03: Type filter changes fetch params
  it('sends type filter in API request', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    // Initial call should include all types
    const url0 = mockFetch.mock.calls[0][0]
    expect(url0).toContain('types=')

    // Uncheck Contract
    const contractFilter = wrapper.find('[data-testid="ge-filter-contract"] input')
    await contractFilter.setValue(false)
    await flushPromises()

    const url1 = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0]
    expect(url1).not.toContain('Contract')
    expect(url1).toContain('Company')
  })

  // GE-UI-04: Keyword filter exists and is usable
  it('has a keyword filter input', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    const input = wrapper.find('[data-testid="ge-keyword"]')
    expect(input.exists()).toBe(true)
  })

  // GE-UI-06: Status bar shows node/edge count
  it('shows node and edge count in status bar', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    const status = wrapper.find('[data-testid="ge-status"]')
    expect(status.exists()).toBe(true)
    expect(status.text()).toContain('3 nodes')
    expect(status.text()).toContain('2 edges')
  })

  // GE-UI-09: Empty graph shows message
  it('shows empty message when no nodes returned', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse({
        nodes: [],
        edges: [],
        total_available: 0,
      }),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    expect(wrapper.find('[data-testid="ge-empty"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No connections found')
  })

  // GE-UI-10: Truncated graph shows warning
  it('shows truncation warning when response is truncated', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse({
        truncated: true,
        total_available: 600,
      }),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    expect(wrapper.find('[data-testid="ge-truncated"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('600')
  })

  // Error state
  it('shows error message on API failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    const wrapper = mountExplorer()
    await flushPromises()

    expect(wrapper.find('[data-testid="ge-error"]').exists()).toBe(true)
  })

  // Loading state
  it('shows loading indicator while fetching', async () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    const wrapper = mountExplorer()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="ge-loading"]').exists()).toBe(true)
  })

  // Controls render
  it('renders all control elements', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    expect(wrapper.find('[data-testid="ge-controls"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ge-depth-slider"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ge-filter-company"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ge-filter-contract"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ge-filter-authority"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ge-filter-person"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ge-keyword"]').exists()).toBe(true)
  })
})
