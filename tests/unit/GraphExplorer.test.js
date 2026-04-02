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
  edges: vi.fn(() => ({
    forEach: vi.fn(),
  })),
  svg: vi.fn(() => '<svg></svg>'),
  png: vi.fn(() => 'data:image/png;base64,fake'),
  json: vi.fn(() => ({ elements: [] })),
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

  // ── Path finding tests ──────────────────────────────────────

  // GE-UI-12: Path mode toggle shows search bar
  it('clicking "Find path to…" shows the path search bar', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    expect(wrapper.find('[data-testid="ge-path-bar"]').exists()).toBe(false)

    await wrapper.find('[data-testid="ge-path-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="ge-path-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ge-path-input"]').exists()).toBe(true)
  })

  // GE-UI-13: Path legend shows after paths found
  it('shows path legend with hop count after path found', async () => {
    // First call: graph data
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    // Enter path mode
    await wrapper.find('[data-testid="ge-path-toggle"]').trigger('click')

    // Mock path finding response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        from_node: { id: 'comp-aaa', label: 'Acme Corp', type: 'Company' },
        to_node: { id: 'comp-bbb', label: 'Beta Ltd', type: 'Company' },
        paths: [
          {
            length: 2,
            node_ids: ['comp-aaa', 'con-111', 'comp-bbb'],
            edges: [
              { source: 'con-111', target: 'comp-aaa', type: 'AWARDED_TO' },
              { source: 'con-111', target: 'comp-bbb', type: 'AWARDED_TO' },
            ],
          },
        ],
        shortest_length: 2,
      }),
    })

    // Directly call selectPathTarget (bypasses debounced search)
    wrapper.vm.selectPathTarget({ id: 'comp-bbb', label: 'Beta Ltd', type: 'Company' })
    await flushPromises()

    const legend = wrapper.find('[data-testid="ge-path-legend"]')
    expect(legend.exists()).toBe(true)
    expect(legend.text()).toContain('1 path found')
    expect(legend.text()).toContain('Shortest: 2 hops')
  })

  // No paths found message
  it('shows "no paths" message when API returns empty paths', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    // Enter path mode and directly set target + path data
    await wrapper.find('[data-testid="ge-path-toggle"]').trigger('click')

    // Mock path finding with no results
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        from_node: { id: 'comp-aaa', label: 'Acme Corp', type: 'Company' },
        to_node: { id: 'comp-zzz', label: 'Nowhere Inc', type: 'Company' },
        paths: [],
        shortest_length: null,
      }),
    })

    // Manually call selectPathTarget (simulates clicking a search result)
    wrapper.vm.selectPathTarget({ id: 'comp-zzz', label: 'Nowhere Inc', type: 'Company' })
    await flushPromises()

    expect(wrapper.find('[data-testid="ge-path-none"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No paths found')
  })

  // Exit path mode clears state
  it('exiting path mode clears path data and legend', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    // Enter path mode
    await wrapper.find('[data-testid="ge-path-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="ge-path-bar"]').exists()).toBe(true)

    // Exit path mode
    await wrapper.find('[data-testid="ge-path-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="ge-path-bar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ge-path-legend"]').exists()).toBe(false)
  })

  // Path toggle button exists
  it('has a "Find path to…" toggle button', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    const btn = wrapper.find('[data-testid="ge-path-toggle"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('Find path to')
  })

  // ── Export tests ────────────────────────────────────────────

  // GE-UI-14: Export buttons exist
  it('renders SVG, PNG, and JSON export buttons', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    expect(wrapper.find('[data-testid="ge-export-svg"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ge-export-png"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ge-export-json"]').exists()).toBe(true)
  })

  // GE-UI-14b: Export SVG calls cy.svg()
  it('SVG export calls cy.svg()', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    // Stub URL and createElement to prevent jsdom errors
    const origCreate = URL.createObjectURL
    const origRevoke = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()

    await wrapper.find('[data-testid="ge-export-svg"]').trigger('click')
    expect(mockCy.svg).toHaveBeenCalled()

    URL.createObjectURL = origCreate
    URL.revokeObjectURL = origRevoke
  })

  // ── Saved views tests ───────────────────────────────────────

  // GE-UI-15: Save view stores in localStorage
  it('saving a view stores state in localStorage', async () => {
    localStorage.removeItem('gmr-graph-saved-views')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    // Mock prompt to return a name
    vi.spyOn(window, 'prompt').mockReturnValue('My Graph')

    await wrapper.find('[data-testid="ge-save-view"]').trigger('click')

    const stored = JSON.parse(localStorage.getItem('gmr-graph-saved-views'))
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('My Graph')
    expect(stored[0].centerId).toBe('comp-aaa')
    expect(stored[0].depth).toBe(1)

    window.prompt.mockRestore?.()
  })

  // Saved views panel shows after saving
  it('shows saved views panel after saving and clicking "Saved" button', async () => {
    localStorage.setItem('gmr-graph-saved-views', JSON.stringify([
      { name: 'Test View', centerId: 'comp-aaa', depth: 2, savedAt: '2026-04-01' },
    ]))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    const savedBtn = wrapper.find('[data-testid="ge-show-saved"]')
    expect(savedBtn.exists()).toBe(true)
    expect(savedBtn.text()).toContain('Saved (1)')

    await savedBtn.trigger('click')
    expect(wrapper.find('[data-testid="ge-saved-panel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Test View')
  })

  // Delete saved view
  it('deleting a saved view removes it from localStorage', async () => {
    localStorage.setItem('gmr-graph-saved-views', JSON.stringify([
      { name: 'View A', centerId: 'comp-aaa', depth: 1, savedAt: '2026-04-01' },
      { name: 'View B', centerId: 'comp-bbb', depth: 2, savedAt: '2026-04-01' },
    ]))
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })
    const wrapper = mountExplorer()
    await flushPromises()

    // Open saved panel
    await wrapper.find('[data-testid="ge-show-saved"]').trigger('click')
    // Delete first view
    await wrapper.find('[data-testid="ge-saved-delete-0"]').trigger('click')

    const stored = JSON.parse(localStorage.getItem('gmr-graph-saved-views'))
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('View B')
  })
})
