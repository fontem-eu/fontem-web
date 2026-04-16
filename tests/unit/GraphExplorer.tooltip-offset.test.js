/**
 * GE-REG-05: Tooltip position must account for canvas offset within component.
 *
 * Bug: renderer.graphToViewport() returns coordinates relative to the canvas
 * element itself. The tooltip is positioned absolute within .graph-explorer,
 * but the canvas sits below the controls bar, so its offsetTop is non-zero.
 * Without correcting for that offset the tooltip renders too far to the
 * top-left — most visible on mobile where the component is scrolled or the
 * layout pushes the canvas down further.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import GraphExplorer from '../../src/components/GraphExplorer.vue'

// ── Shared state hoisted so it is reachable inside vi.mock() ──
// vi.hoisted() runs before module imports, so these variables are accessible
// inside the vi.mock() factory below.
const { sigmaHandlers, mockGraphToViewport } = vi.hoisted(() => ({
  sigmaHandlers: {},
  mockGraphToViewport: vi.fn(),
}))

// Mock sigma so we control graphToViewport() and capture clickNode handlers.
// The dynamic import('sigma') inside ensureImports() is intercepted here.
vi.mock('sigma', () => {
  class MockSigma {
    on(event, handler) {
      sigmaHandlers[event] = handler
    }
    graphToViewport(attrs) {
      return mockGraphToViewport(attrs)
    }
    kill() {}
    setSetting() {}
    refresh() {}
    getCanvases() { return {} }
  }
  return { default: MockSigma, Sigma: MockSigma }
})

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const DEFAULT_ENTITY_ID = 'aaa00000-0000-4000-8000-000000000001'

function makeGraphResponse() {
  return {
    center: { id: DEFAULT_ENTITY_ID, label: 'Acme Corp', type: 'Company', properties: {} },
    nodes: [
      { id: DEFAULT_ENTITY_ID, label: 'Acme Corp', type: 'Company', properties: {} },
      { id: 'con-111', label: 'Road works', type: 'Contract', properties: { value_eur: 500000 } },
      { id: 'auth-xxx', label: 'Ville de Paris', type: 'Authority', properties: { country: 'FRA' } },
    ],
    edges: [
      { source: 'con-111', target: DEFAULT_ENTITY_ID, type: 'AWARDED_TO', properties: {} },
      { source: 'auth-xxx', target: 'con-111', type: 'AWARDED', properties: {} },
    ],
    truncated: false,
    total_available: 3,
  }
}

/**
 * Wait for the Sigma renderer to register its clickNode handler.
 * renderGraph() is not awaited in onMounted, so dynamic imports inside
 * ensureImports() may need several microtask / macrotask passes beyond
 * what a single flushPromises() covers.
 */
async function waitForRenderer(timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs
  while (!sigmaHandlers.clickNode) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for Sigma renderer')
    await flushPromises()
  }
}

describe('GraphExplorer — tooltip offset regression (GE-REG-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear captured handlers from previous test
    Object.keys(sigmaHandlers).forEach((k) => delete sigmaHandlers[k])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('tooltip x/y include the canvas offsetLeft/offsetTop within the component', async () => {
    // The canvas sits below the controls bar. On a typical layout the controls
    // bar is ~64 px tall, making canvas.offsetTop === 64. On mobile it can be
    // even larger due to wrapping. Without the fix, tooltip.y would be 80
    // (raw viewport y) instead of the correct 80 + 64 = 144.
    const CANVAS_OFFSET_LEFT = 0
    const CANVAS_OFFSET_TOP = 64   // controls bar height
    const VIEWPORT_X = 120         // what graphToViewport reports (canvas-relative)
    const VIEWPORT_Y = 80

    mockGraphToViewport.mockReturnValue({ x: VIEWPORT_X, y: VIEWPORT_Y })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })

    const wrapper = mount(GraphExplorer, {
      props: { entityId: DEFAULT_ENTITY_ID },
      attachTo: document.body,
    })

    // Wait for the full async initialisation chain:
    //   fetchGraph() → renderGraph() → ensureImports() (dynamic imports) → new Sigma()
    // renderGraph() is not awaited in onMounted, so we poll until the
    // clickNode handler is registered rather than relying on a fixed number
    // of flushPromises() calls.
    await waitForRenderer()

    // Simulate the canvas being pushed down by the controls bar
    const canvasEl = wrapper.find('[data-testid="ge-canvas"]').element
    Object.defineProperty(canvasEl, 'offsetLeft', { get: () => CANVAS_OFFSET_LEFT, configurable: true })
    Object.defineProperty(canvasEl, 'offsetTop', { get: () => CANVAS_OFFSET_TOP, configurable: true })

    // Switch to fake timers now so we can skip the 250 ms click debounce
    vi.useFakeTimers()

    // Fire a single click on a node
    sigmaHandlers.clickNode({ node: DEFAULT_ENTITY_ID })

    // Advance past the 250 ms single-click disambiguation delay
    vi.advanceTimersByTime(300)
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.tooltip).not.toBeNull()

    // The tooltip must be offset-corrected — not raw canvas-relative coords
    expect(wrapper.vm.tooltip.x).toBe(VIEWPORT_X + CANVAS_OFFSET_LEFT) // 120
    expect(wrapper.vm.tooltip.y).toBe(VIEWPORT_Y + CANVAS_OFFSET_TOP)  // 144

    wrapper.unmount()
  })

  it('tooltip position is correct when canvas has no offset (controls bar absent)', async () => {
    // Edge case: if offsetTop/offsetLeft happen to be 0, the result must still
    // equal the raw viewport coordinates.
    const VIEWPORT_X = 200
    const VIEWPORT_Y = 150

    mockGraphToViewport.mockReturnValue({ x: VIEWPORT_X, y: VIEWPORT_Y })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => makeGraphResponse(),
    })

    const wrapper = mount(GraphExplorer, {
      props: { entityId: DEFAULT_ENTITY_ID },
      attachTo: document.body,
    })

    await waitForRenderer()

    // offsetTop/offsetLeft default to 0 in jsdom — no override needed

    vi.useFakeTimers()
    sigmaHandlers.clickNode({ node: DEFAULT_ENTITY_ID })
    vi.advanceTimersByTime(300)
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.tooltip).not.toBeNull()
    expect(wrapper.vm.tooltip.x).toBe(VIEWPORT_X)
    expect(wrapper.vm.tooltip.y).toBe(VIEWPORT_Y)

    wrapper.unmount()
  })
})
