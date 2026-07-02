import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// maplibre needs a real GL context — fake the map; call the load handler so render() runs.
vi.mock('maplibre-gl', () => {
  const makeMap = () => ({
    addControl() {}, on(evt, cb) { if (evt === 'load') cb() }, once(evt, cb) { if (evt === 'load') cb() },
    isStyleLoaded: () => true, getSource: () => null, addSource() {}, addLayer() {}, setPaintProperty() {}, remove() {},
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
})
