/**
 * Tests for the GeoChoropleth component.
 *
 * MapLibre needs WebGL / real DOM which jsdom doesn't have — we mock the
 * whole module with a minimal stub so we can assert on the Vue behavior
 * (controls, fetching, rendering), not the map canvas itself.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// Hoisted Map stub — captured events + addSource/addLayer call log
const { mapInstance } = vi.hoisted(() => ({
  mapInstance: {
    addControl: vi.fn(),
    on: vi.fn(),
    once: vi.fn((event, cb) => { if (event === 'load') cb() }),
    addSource: vi.fn(),
    getSource: vi.fn(),
    addLayer: vi.fn(),
    getLayer: vi.fn(),
    getCanvas: vi.fn(() => ({ style: {} })),
    isStyleLoaded: vi.fn(() => true),
    setPaintProperty: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(() => mapInstance),
    NavigationControl: vi.fn(),
  },
}))
// Stylesheet import — just stub it out
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

// Stub fetch for api/geo.js
const originalFetch = globalThis.fetch

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.fetch = vi.fn().mockImplementation((url) => {
    if (url.includes('/geo/aggregate')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          level: 0, metric: 'companies', regions: [
            { nuts_code: 'DE', label: 'Deutschland', level: 0, value: 1000 },
            { nuts_code: 'FR', label: 'France', level: 0, value: 500 },
          ],
        }),
      })
    }
    if (url.includes('/geo/nuts-boundaries')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', properties: { nuts_code: 'DE', name: 'Deutschland' }, geometry: {} },
            { type: 'Feature', properties: { nuts_code: 'FR', name: 'France' }, geometry: {} },
          ],
        }),
      })
    }
    return Promise.resolve({ ok: false, status: 404, text: async () => '' })
  })
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// Dynamic import so the maplibre mock is in place first
async function mountIt() {
  const { default: GeoChoropleth } = await import('../../src/components/GeoChoropleth.vue')
  return mount(GeoChoropleth, { attachTo: document.body })
}

describe('GeoChoropleth — controls + data fetching', () => {
  it('renders the controls bar with level + metric + connected-to', async () => {
    const wrapper = await mountIt()
    await flushPromises()
    expect(wrapper.find('[data-testid="geo-level"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="geo-metric"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="geo-connected-to"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('fetches aggregate + boundaries on mount', async () => {
    const wrapper = await mountIt()
    await flushPromises()
    const urls = globalThis.fetch.mock.calls.map((c) => c[0])
    expect(urls.some((u) => u.includes('/geo/aggregate'))).toBe(true)
    expect(urls.some((u) => u.includes('/geo/nuts-boundaries'))).toBe(true)
    wrapper.unmount()
  })

  it('adds the choropleth layer once boundaries load', async () => {
    const wrapper = await mountIt()
    await flushPromises()
    expect(mapInstance.addSource).toHaveBeenCalledWith(
      'nuts',
      expect.objectContaining({ type: 'geojson' }),
    )
    const layers = mapInstance.addLayer.mock.calls.map((c) => c[0].id)
    expect(layers).toContain('nuts-fill')
    expect(layers).toContain('nuts-line')
    wrapper.unmount()
  })

  it('changing the metric triggers a new aggregate fetch', async () => {
    const wrapper = await mountIt()
    await flushPromises()
    const before = globalThis.fetch.mock.calls.length

    await wrapper.find('[data-testid="geo-metric"]').setValue('contracts_eur')
    await flushPromises()

    const after = globalThis.fetch.mock.calls.length
    expect(after).toBeGreaterThan(before)
    const lastAgg = globalThis.fetch.mock.calls
      .map((c) => c[0])
      .reverse()
      .find((u) => u.includes('/geo/aggregate'))
    expect(lastAgg).toContain('metric=contracts_eur')
    wrapper.unmount()
  })

  it('connected-to filter is forwarded to the API', async () => {
    const wrapper = await mountIt()
    await flushPromises()

    await wrapper.find('[data-testid="geo-connected-to"]').setValue('RUS')
    await flushPromises()

    const lastAgg = globalThis.fetch.mock.calls
      .map((c) => c[0])
      .reverse()
      .find((u) => u.includes('/geo/aggregate'))
    expect(lastAgg).toContain('connected_to_country=RUS')
    wrapper.unmount()
  })

  it('unmount cleans up the map instance', async () => {
    const wrapper = await mountIt()
    await flushPromises()
    wrapper.unmount()
    expect(mapInstance.remove).toHaveBeenCalled()
  })

  it('shows an error banner when the aggregate fetch fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500, text: async () => 'boom',
    })
    const wrapper = await mountIt()
    await flushPromises()
    expect(wrapper.find('[data-testid="geo-error"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
