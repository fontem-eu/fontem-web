import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// maplibre needs a real GL context — fake the map; call the load handler so render() runs.
const layerHandlers = {}
vi.mock('maplibre-gl', () => {
  const makeMap = () => ({
    addControl() {},
    on(evt, layerOrCb, cb) {
      if (evt === 'load' && typeof layerOrCb === 'function') { layerOrCb(); return }
      if (typeof cb === 'function') layerHandlers[`${evt}:${layerOrCb}`] = cb
    },
    once(evt, cb) { if (evt === 'load') cb() },
    isStyleLoaded: () => true, getSource: () => null, addSource() {}, addLayer() {}, setPaintProperty() {}, remove() {},
    getCanvas: () => ({ style: {} }),
  })
  return { default: { Map: vi.fn(makeMap), NavigationControl: vi.fn(() => ({})) } }
})
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))
const fetchBoundaries = vi.fn()
vi.mock('../../src/api/geo.js', () => ({ fetchBoundaries: (...a) => fetchBoundaries(...a) }))

import StudioMap from '../../src/components/StudioMap.vue'

describe('StudioMap (studio choropleth)', () => {
  beforeEach(() => { fetchBoundaries.mockReset() })

  it('joins rows to boundaries by NUTS code and reports coverage', async () => {
    fetchBoundaries.mockResolvedValue({ type: 'FeatureCollection', features: [
      { properties: { nuts_code: 'DE' } }, { properties: { nuts_code: 'FR' } }, { properties: { nuts_code: 'ES' } },
    ] })
    const w = mount(StudioMap, { props: {
      rows: [['DE', 100], ['FR', 250]], columns: ['region', 'value'], geoCol: 'region', valueCol: 'value', level: 0,
    } })
    await flushPromises()
    expect(fetchBoundaries).toHaveBeenCalledWith(0)
    expect(w.find('[data-testid="map-coverage"]').text()).toContain('matched 2 of 2')
  })

  it('joins alpha-3 data via the boundaries country_a3 property', async () => {
    fetchBoundaries.mockResolvedValue({ type: 'FeatureCollection', features: [
      { properties: { nuts_code: 'HU', country_a3: 'HUN' } },
      { properties: { nuts_code: 'DE', country_a3: 'DEU' } },
    ] })
    const w = mount(StudioMap, { props: {
      rows: [['HUN', 47], ['DEU', 22]], columns: ['country', 'pct'], geoCol: 'country', valueCol: 'pct', level: 0,
    } })
    await flushPromises()
    expect(w.find('[data-testid="map-coverage"]').text()).toContain('matched 2 of 2')
  })

  it('warns when nothing matches (wrong column/level)', async () => {
    fetchBoundaries.mockResolvedValue({ type: 'FeatureCollection', features: [{ properties: { nuts_code: 'DE' } }] })
    const w = mount(StudioMap, { props: {
      rows: [['XX', 1], ['YY', 2]], columns: ['g', 'v'], geoCol: 'g', valueCol: 'v', level: 2,
    } })
    await flushPromises()
    expect(fetchBoundaries).toHaveBeenCalledWith(2)
    expect(w.find('[data-testid="map-coverage"]').text()).toContain('wrong column/level')
  })

  it('bivariate choropleth renders the 3×3 key from a 2nd value column', async () => {
    fetchBoundaries.mockResolvedValue({ type: 'FeatureCollection', features: [
      { properties: { nuts_code: 'DE' } }, { properties: { nuts_code: 'FR' } },
      { properties: { nuts_code: 'ES' } }, { properties: { nuts_code: 'IT' } },
    ] })
    const w = mount(StudioMap, { props: {
      rows: [['DE', 10, 1], ['FR', 20, 5], ['ES', 30, 9], ['IT', 40, 3]],
      columns: ['region', 'rate', 'volume'], geoCol: 'region', valueCol: 'rate',
      value2Col: 'volume', bivariate: 'choropleth', level: 0,
    } })
    await flushPromises()
    const key = w.find('[data-testid="map-legend-biv"]')
    expect(key.exists()).toBe(true)
    expect(key.findAll('.biv-cell').length).toBe(9)
    expect(key.text()).toContain('rate')
    expect(key.text()).toContain('volume')
    expect(w.find('[data-testid="map-coverage"]').text()).toContain('matched 4 of 4')
  })

  it('value-by-alpha mode shows the diverging colour + opacity legend', async () => {
    fetchBoundaries.mockResolvedValue({ type: 'FeatureCollection', features: [
      { properties: { nuts_code: 'DE' } }, { properties: { nuts_code: 'FR' } }, { properties: { nuts_code: 'ES' } },
    ] })
    const w = mount(StudioMap, { props: {
      rows: [['DE', 10, 1], ['FR', 20, 5], ['ES', 30, 9]],
      columns: ['region', 'rate', 'volume'], geoCol: 'region', valueCol: 'rate',
      value2Col: 'volume', bivariate: 'alpha', level: 0,
    } })
    await flushPromises()
    const leg = w.find('[data-testid="map-legend-alpha"]')
    expect(leg.exists()).toBe(true)
    expect(leg.text()).toContain('opacity = volume')
  })

  it('hover/tap readout shows the region and its values', async () => {
    fetchBoundaries.mockResolvedValue({ features: [
      { properties: { nuts_code: 'FR', country_a3: 'FRA', name: 'France' } },
    ] })
    const w = mount(StudioMap, { props: {
      rows: [['FR', 65.9, 8.8]], columns: ['country', 'rape_100k', 'foreign_pct'],
      geoCol: 'country', valueCol: 'rape_100k', value2Col: 'foreign_pct', bivariate: 'alpha', level: 0,
    } })
    await flushPromises()
    // the same handler is registered for mousemove (hover) and click (tap)
    expect(typeof layerHandlers['mousemove:nuts-fill']).toBe('function')
    expect(typeof layerHandlers['click:nuts-fill']).toBe('function')
    layerHandlers['click:nuts-fill']({ features: [{ properties: {
      name: 'France', nuts_code: 'FR', value: 65.9, value2: 8.8, hasData: 1,
    } }] })
    await w.vm.$nextTick()
    const ro = w.find('[data-testid="map-hover-readout"]')
    expect(ro.exists()).toBe(true)
    expect(ro.text()).toContain('France')
    expect(ro.text()).toContain('rape_100k: 65.9')
    expect(ro.text()).toContain('foreign_pct: 8.8')
    w.unmount()
  })
})
