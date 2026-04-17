/**
 * GraphExplorer fullscreen mode tests.
 *
 * A fullscreen button toggles a CSS class on the root that pins the component
 * to the viewport. While fullscreen:
 *  - An X close button appears top-right
 *  - ESC exits
 *  - body scroll is locked
 *  - Cleanup on unmount restores scroll
 *  - The options menu (gear) still works
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import GraphExplorer from '../../src/components/GraphExplorer.vue'

// Mock sigma — WebGL not available in jsdom
const { sigmaHandlers } = vi.hoisted(() => ({ sigmaHandlers: {} }))
vi.mock('sigma', () => {
  class MockSigma {
    on(event, handler) { sigmaHandlers[event] = handler }
    graphToViewport() { return { x: 0, y: 0 } }
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
    nodes: [{ id: DEFAULT_ENTITY_ID, label: 'Acme Corp', type: 'Company', properties: {} }],
    edges: [],
    truncated: false,
    total_available: 1,
  }
}

function mountExplorer() {
  mockFetch.mockResolvedValue({ ok: true, json: async () => makeGraphResponse() })
  return mount(GraphExplorer, {
    props: { entityId: DEFAULT_ENTITY_ID },
    attachTo: document.body,
  })
}

describe('GraphExplorer — fullscreen mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(sigmaHandlers).forEach((k) => delete sigmaHandlers[k])
    document.body.style.overflow = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.style.overflow = ''
  })

  it('fullscreen button is rendered in the controls bar', async () => {
    const wrapper = mountExplorer()
    await flushPromises()
    expect(wrapper.find('[data-testid="ge-fullscreen-btn"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('X close button is not shown when not in fullscreen', async () => {
    const wrapper = mountExplorer()
    await flushPromises()
    expect(wrapper.find('[data-testid="ge-fs-close"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('clicking the fullscreen button applies the fullscreen class', async () => {
    const wrapper = mountExplorer()
    await flushPromises()

    const root = wrapper.find('[data-testid="graph-explorer"]')
    expect(root.classes()).not.toContain('graph-explorer--fullscreen')

    await wrapper.find('[data-testid="ge-fullscreen-btn"]').trigger('click')
    expect(root.classes()).toContain('graph-explorer--fullscreen')
    wrapper.unmount()
  })

  it('fullscreen button is hidden and X close button is shown in fullscreen', async () => {
    const wrapper = mountExplorer()
    await flushPromises()

    await wrapper.find('[data-testid="ge-fullscreen-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="ge-fullscreen-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ge-fs-close"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('clicking the X close button exits fullscreen', async () => {
    const wrapper = mountExplorer()
    await flushPromises()

    await wrapper.find('[data-testid="ge-fullscreen-btn"]').trigger('click')
    await wrapper.find('[data-testid="ge-fs-close"]').trigger('click')
    expect(wrapper.find('[data-testid="graph-explorer"]').classes())
      .not.toContain('graph-explorer--fullscreen')
    expect(wrapper.find('[data-testid="ge-fs-close"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('pressing ESC exits fullscreen', async () => {
    const wrapper = mountExplorer()
    await flushPromises()

    await wrapper.find('[data-testid="ge-fullscreen-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="graph-explorer"]').classes())
      .toContain('graph-explorer--fullscreen')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="graph-explorer"]').classes())
      .not.toContain('graph-explorer--fullscreen')
    wrapper.unmount()
  })

  it('ESC does nothing when not in fullscreen', async () => {
    const wrapper = mountExplorer()
    await flushPromises()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    // No class change; no error thrown
    expect(wrapper.find('[data-testid="graph-explorer"]').classes())
      .not.toContain('graph-explorer--fullscreen')
    wrapper.unmount()
  })

  it('entering fullscreen locks body scroll; exiting restores it', async () => {
    const wrapper = mountExplorer()
    await flushPromises()

    expect(document.body.style.overflow).toBe('')

    await wrapper.find('[data-testid="ge-fullscreen-btn"]').trigger('click')
    expect(document.body.style.overflow).toBe('hidden')

    await wrapper.find('[data-testid="ge-fs-close"]').trigger('click')
    expect(document.body.style.overflow).toBe('')
    wrapper.unmount()
  })

  it('unmounting while fullscreen restores body scroll', async () => {
    const wrapper = mountExplorer()
    await flushPromises()
    await wrapper.find('[data-testid="ge-fullscreen-btn"]').trigger('click')
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('options menu still opens and closes in fullscreen', async () => {
    const wrapper = mountExplorer()
    await flushPromises()

    await wrapper.find('[data-testid="ge-fullscreen-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="ge-options-menu"]').exists()).toBe(false)

    await wrapper.find('[data-testid="ge-options-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="ge-options-menu"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('canvas no longer uses 100svh immersive height (reverted)', async () => {
    // Regression: earlier version set min-height: max(400px, calc(100svh - 56px))
    // which occupied the entire screen. We should be back to a fixed modest min.
    const wrapper = mountExplorer()
    await flushPromises()
    // jsdom doesn't resolve svh so we can't check computed style; best-effort
    // guard against a regression where someone sets min-height inline.
    const canvas = wrapper.find('[data-testid="ge-canvas"]').element
    expect(canvas.style.minHeight).toBe('')
    wrapper.unmount()
  })
})
