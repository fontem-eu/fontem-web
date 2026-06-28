import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const mapInstance = {
  addControl: vi.fn(), on: vi.fn(),
  once: vi.fn((event, cb) => { if (event === 'load') cb() }),
  addSource: vi.fn(), getSource: vi.fn(() => null), addLayer: vi.fn(),
  getCanvas: vi.fn(() => ({ style: {} })), isStyleLoaded: vi.fn(() => true),
  setPaintProperty: vi.fn(), remove: vi.fn(),
}
vi.mock('maplibre-gl', () => ({
  default: { Map: vi.fn((opts) => { if (!opts?.container) throw new Error('container required'); return mapInstance }), NavigationControl: vi.fn() },
}))
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import AtlasMapEmbed from '../../src/widgets/AtlasMapEmbed.vue'
import maplibregl from 'maplibre-gl'

const SERIES = { data: [
  { geo_code: 'DE', year: 2013, dimensions: { iccs: 'ICCS03011', unit: 'P_HTHAB' }, value: 9.2 },
  { geo_code: 'SE', year: 2013, dimensions: { iccs: 'ICCS03011', unit: 'P_HTHAB' }, value: 59.0 },
] }
const BOUNDARIES = { type: 'FeatureCollection', features: [
  { type: 'Feature', properties: { nuts_code: 'DE', name: 'Germany' }, geometry: { type: 'Polygon', coordinates: [] } },
  { type: 'Feature', properties: { nuts_code: 'SE', name: 'Sweden' }, geometry: { type: 'Polygon', coordinates: [] } },
] }
const DATASETS = [{ code: 'crim_off_cat', label: 'Recorded offences', dim_labels: {} }]

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn((url) => {
    if (url.includes('/atlas/datasets')) return Promise.resolve({ ok: true, json: async () => DATASETS })
    if (url.includes('/atlas/series')) return Promise.resolve({ ok: true, json: async () => SERIES })
    if (url.includes('/slice-stats')) return Promise.resolve({ ok: true, json: async () => [] })
    if (url.includes('/geo/nuts-boundaries')) return Promise.resolve({ ok: true, json: async () => BOUNDARIES })
    return Promise.resolve({ ok: true, json: async () => ({}) })
  })
})
afterEach(() => { vi.restoreAllMocks() })

const cfg = { widget_type: 'atlas_map', dataset: 'crim_off_cat', nuts_level: 0, year: 2013, dimensions: { iccs: 'ICCS03011', unit: 'P_HTHAB' } }

describe('AtlasMapEmbed', () => {
  it('inits maplibre with an INLINE, CSP-safe style — never an external style URL', async () => {
    mount(AtlasMapEmbed, { props: { config: cfg }, global: { mocks: { $t: (k) => k } } })
    await flushPromises()
    expect(maplibregl.Map).toHaveBeenCalledTimes(1)
    const style = maplibregl.Map.mock.calls[0][0].style
    // The "renders nothing" bug was an external openfreemap.org style URL the CSP
    // blocks, so maplibre 'load' never fired. Style must be an inline object using
    // a CSP-allowlisted tile host.
    expect(typeof style, 'style must be an inline object, not an external URL string').toBe('object')
    const json = JSON.stringify(style)
    expect(json).toContain('tile.openstreetmap.org')
    expect(json).not.toContain('openfreemap')
  })

  it('adds the choropleth data layer once the style loads (given matching data)', async () => {
    mount(AtlasMapEmbed, { props: { config: cfg }, global: { mocks: { $t: (k) => k } } })
    await flushPromises(); await flushPromises()
    const layerIds = mapInstance.addLayer.mock.calls.map((c) => c[0].id)
    expect(layerIds, 'the data choropleth layer must be added').toContain('atlas-embed-fill')
  })
})
