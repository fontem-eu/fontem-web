/**
 * Tests for EntityNutsMap.vue
 *
 * Covers:
 * - Controls render correctly
 * - Level 0: no scope required, fetches on mount
 * - Level > 0: scope selector appears, fetch blocked until scope selected
 * - Changing level resets scope
 * - Scope selection triggers fetch with correct params
 * - Blue-to-red color scale applied via setPaintProperty
 * - PocketButton is present with correct widget type / config
 * - Error banner shown on API failure
 * - Map cleaned up on unmount
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// ── MapLibre stub ────────────────────────────────────────────────────────────
const { mapInstance } = vi.hoisted(() => ({
  mapInstance: {
    addControl: vi.fn(),
    on: vi.fn(),
    once: vi.fn((event, cb) => { if (event === 'load') cb() }),
    addSource: vi.fn(),
    getSource: vi.fn(() => null),
    addLayer: vi.fn(),
    getLayer: vi.fn(() => null),
    getCanvas: vi.fn(() => ({ style: {} })),
    isStyleLoaded: vi.fn(() => true),
    setPaintProperty: vi.fn(),
    fitBounds: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(() => mapInstance),
    NavigationControl: vi.fn(),
    LngLatBounds: vi.fn(() => ({ extend: vi.fn(), isEmpty: vi.fn(() => false) })),
  },
}))
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

// ── Fetch stubs ───────────────────────────────────────────────────────────────
const ENTITY_ROWS_LEVEL0 = [
  { nuts_code: 'DE', label: 'Deutschland', level: 0, value: 50 },
  { nuts_code: 'FR', label: 'France', level: 0, value: 20 },
]
const ENTITY_ROWS_LEVEL1 = [
  { nuts_code: 'DE1', label: 'Baden-W\u00fcrttemberg', level: 1, value: 10 },
]
const BOUNDARIES_L0 = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { nuts_code: 'DE', name: 'Deutschland' }, geometry: { type: 'Polygon', coordinates: [[[5,47],[15,47],[15,55],[5,55],[5,47]]] } },
    { type: 'Feature', properties: { nuts_code: 'FR', name: 'France' }, geometry: { type: 'Polygon', coordinates: [[[-5,42],[8,42],[8,51],[-5,51],[-5,42]]] } },
  ],
}
const BOUNDARIES_L1 = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { nuts_code: 'DE1', name: 'Baden-W\u00fcrttemberg', country: 'DE' }, geometry: { type: 'Polygon', coordinates: [[[7,47],[10,47],[10,50],[7,50],[7,47]]] } },
  ],
}

const originalFetch = globalThis.fetch

function makeFetch(entityRows = ENTITY_ROWS_LEVEL0) {
  return vi.fn().mockImplementation((url) => {
    if (url.includes('/geo/entity/')) {
      return Promise.resolve({ ok: true, json: async () => ({ entity_id: 'test-id', level: 0, metric: 'contracts', regions: entityRows }) })
    }
    if (url.includes('/geo/nuts-boundaries?level=0')) {
      return Promise.resolve({ ok: true, json: async () => BOUNDARIES_L0 })
    }
    if (url.includes('/geo/nuts-boundaries?level=1')) {
      return Promise.resolve({ ok: true, json: async () => BOUNDARIES_L1 })
    }
    return Promise.resolve({ ok: false, status: 404, text: async () => 'not found' })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.fetch = makeFetch()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

async function mountMap(props = {}) {
  const { default: EntityNutsMap } = await import('../../src/components/EntityNutsMap.vue')
  return mount(EntityNutsMap, {
    props: { entityId: 'test-entity-id', ...props },
    attachTo: document.body,
  })
}

// ── Controls ──────────────────────────────────────────────────────────────────

describe('EntityNutsMap — controls', () => {
  it('renders a level selector with options 0-3', async () => {
    const w = await mountMap()
    await flushPromises()
    const sel = w.find('[data-testid="enu-level"]')
    expect(sel.exists()).toBe(true)
    const opts = sel.findAll('option')
    expect(opts).toHaveLength(4)
    expect(opts.map((o) => o.element.value)).toEqual(['0', '1', '2', '3'])
    w.unmount()
  })

  it('renders a metric selector with contracts + contracts_eur', async () => {
    const w = await mountMap()
    await flushPromises()
    const sel = w.find('[data-testid="enu-metric"]')
    expect(sel.exists()).toBe(true)
    const values = sel.findAll('option').map((o) => o.element.value)
    expect(values).toContain('contracts')
    expect(values).toContain('contracts_eur')
    w.unmount()
  })

  it('does NOT show scope selector at level 0', async () => {
    const w = await mountMap()
    await flushPromises()
    expect(w.find('[data-testid="enu-scope"]').exists()).toBe(false)
    w.unmount()
  })

  it('shows scope selector when level > 0', async () => {
    const w = await mountMap()
    await flushPromises()
    await w.find('[data-testid="enu-level"]').setValue('1')
    await flushPromises()
    expect(w.find('[data-testid="enu-scope"]').exists()).toBe(true)
    w.unmount()
  })

  it('scope selector label mentions the parent level', async () => {
    const w = await mountMap()
    await flushPromises()
    await w.find('[data-testid="enu-level"]').setValue('1')
    await flushPromises()
    const label = w.find('[data-testid="enu-scope-label"]')
    expect(label.text().toLowerCase()).toMatch(/country|nuts.?0/i)
    w.unmount()
  })

  it('scope selector label changes for level 2 → NUTS 1', async () => {
    const w = await mountMap()
    await flushPromises()
    await w.find('[data-testid="enu-level"]').setValue('2')
    await flushPromises()
    const label = w.find('[data-testid="enu-scope-label"]')
    expect(label.text().toLowerCase()).toMatch(/nuts.?1|macro.?region/i)
    w.unmount()
  })

  it('renders a PocketButton', async () => {
    const w = await mountMap()
    await flushPromises()
    expect(w.find('[data-testid="pocket-menu-btn"]').exists()).toBe(true)
    w.unmount()
  })
})

// ── Data fetching ─────────────────────────────────────────────────────────────

describe('EntityNutsMap — data fetching', () => {
  it('fetches entity aggregate + boundaries on mount at level 0', async () => {
    const w = await mountMap()
    await flushPromises()
    const urls = globalThis.fetch.mock.calls.map((c) => c[0])
    expect(urls.some((u) => u.includes('/geo/entity/test-entity-id/aggregate'))).toBe(true)
    expect(urls.some((u) => u.includes('/geo/nuts-boundaries?level=0'))).toBe(true)
    w.unmount()
  })

  it('does NOT fetch when level > 0 and scope is empty', async () => {
    const w = await mountMap()
    await flushPromises()
    const countBefore = globalThis.fetch.mock.calls.length

    await w.find('[data-testid="enu-level"]').setValue('1')
    await flushPromises()

    // Only the parent boundaries fetch (for scope dropdown) may fire — but NOT the entity aggregate
    const newCalls = globalThis.fetch.mock.calls.slice(countBefore).map((c) => c[0])
    const entityAggCalls = newCalls.filter((u) => u.includes('/geo/entity/') && u.includes('/aggregate'))
    expect(entityAggCalls).toHaveLength(0)
    w.unmount()
  })

  it('fetches with scope_nuts once scope is selected', async () => {
    const w = await mountMap()
    await flushPromises()

    await w.find('[data-testid="enu-level"]').setValue('1')
    await flushPromises()

    // Pick a scope from the dropdown
    const scopeSel = w.find('[data-testid="enu-scope"]')
    await scopeSel.setValue('DE')
    await flushPromises()

    const calls = globalThis.fetch.mock.calls.map((c) => c[0])
    const aggCall = calls.find((u) => u.includes('/aggregate') && u.includes('scope_nuts=DE'))
    expect(aggCall).toBeTruthy()
    expect(aggCall).toContain('level=1')
    w.unmount()
  })

  it('forwards the correct entity_id in the URL', async () => {
    const w = await mountMap({ entityId: 'special-entity-uuid' })
    await flushPromises()
    const calls = globalThis.fetch.mock.calls.map((c) => c[0])
    expect(calls.some((u) => u.includes('/geo/entity/special-entity-uuid/'))).toBe(true)
    w.unmount()
  })

  it('changing metric triggers a new fetch', async () => {
    const w = await mountMap()
    await flushPromises()
    const before = globalThis.fetch.mock.calls.length

    await w.find('[data-testid="enu-metric"]').setValue('contracts_eur')
    await flushPromises()

    const after = globalThis.fetch.mock.calls.length
    expect(after).toBeGreaterThan(before)
    const lastAgg = globalThis.fetch.mock.calls
      .map((c) => c[0])
      .filter((u) => u.includes('/aggregate'))
      .at(-1)
    expect(lastAgg).toContain('metric=contracts_eur')
    w.unmount()
  })

  it('changing level resets scope and does not fire aggregate', async () => {
    globalThis.fetch = makeFetch(ENTITY_ROWS_LEVEL1)
    const w = await mountMap()
    await flushPromises()

    // Set level 1 and pick a scope
    await w.find('[data-testid="enu-level"]').setValue('1')
    await flushPromises()
    const scopeSel = w.find('[data-testid="enu-scope"]')
    await scopeSel.setValue('DE')
    await flushPromises()

    const countAfterScope = globalThis.fetch.mock.calls.length

    // Now change level — scope should reset
    await w.find('[data-testid="enu-level"]').setValue('2')
    await flushPromises()

    const newEntityCalls = globalThis.fetch.mock.calls
      .slice(countAfterScope)
      .map((c) => c[0])
      .filter((u) => u.includes('/geo/entity/') && u.includes('/aggregate'))
    // No aggregate call should fire because scope was reset
    expect(newEntityCalls).toHaveLength(0)
    w.unmount()
  })
})

// ── Map rendering ─────────────────────────────────────────────────────────────

describe('EntityNutsMap — map rendering', () => {
  it('adds nuts-fill and nuts-line layers after data loads', async () => {
    const w = await mountMap()
    await flushPromises()
    const layerIds = mapInstance.addLayer.mock.calls.map((c) => c[0].id)
    expect(layerIds).toContain('enu-fill')
    expect(layerIds).toContain('enu-line')
    w.unmount()
  })

  it('fill-color expression uses a step function', async () => {
    const w = await mountMap()
    await flushPromises()
    const fillCall = mapInstance.addLayer.mock.calls.find((c) => c[0].id === 'enu-fill')
    const fillColor = fillCall[0].paint['fill-color']
    expect(fillColor[0]).toBe('step')
    w.unmount()
  })

  it('color stops include both blue and red tones', async () => {
    const w = await mountMap()
    await flushPromises()
    // Check setPaintProperty was called; colors should span blue→red range
    const fillCall = mapInstance.addLayer.mock.calls.find((c) => c[0].id === 'enu-fill')
    const stopColors = fillCall[0].paint['fill-color'].filter(
      (v) => typeof v === 'string' && v.startsWith('#'),
    )
    const hasBlue = stopColors.some((c) => {
      const b = parseInt(c.slice(5, 7), 16)
      const r = parseInt(c.slice(1, 3), 16)
      return b > r
    })
    const hasRed = stopColors.some((c) => {
      const r = parseInt(c.slice(1, 3), 16)
      const b = parseInt(c.slice(5, 7), 16)
      return r > b
    })
    expect(hasBlue).toBe(true)
    expect(hasRed).toBe(true)
    w.unmount()
  })

  it('injects value into each GeoJSON feature property', async () => {
    const w = await mountMap()
    await flushPromises()
    const srcCall = mapInstance.addSource.mock.calls.find((c) => c[0] === 'enu')
    const geojson = srcCall[1].data
    const deFeature = geojson.features.find((f) => f.properties.nuts_code === 'DE')
    expect(deFeature.properties.value).toBe(50)
    w.unmount()
  })

  it('cleans up the map on unmount', async () => {
    const w = await mountMap()
    await flushPromises()
    w.unmount()
    expect(mapInstance.remove).toHaveBeenCalled()
  })
})

// ── Error + loading states ────────────────────────────────────────────────────

describe('EntityNutsMap — error states', () => {
  it('shows an error banner when entity aggregate fetch fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500, text: async () => 'server error',
    })
    const w = await mountMap()
    await flushPromises()
    expect(w.find('[data-testid="enu-error"]').exists()).toBe(true)
    w.unmount()
  })

  it('shows loading indicator while fetching', async () => {
    let resolveAggregate
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/geo/entity/')) {
        return new Promise((res) => { resolveAggregate = res })
      }
      return Promise.resolve({ ok: true, json: async () => BOUNDARIES_L0 })
    })
    const w = await mountMap()
    // Loading should be visible before promise resolves
    expect(w.find('[data-testid="enu-loading"]').exists()).toBe(true)
    resolveAggregate({ ok: true, json: async () => ({ regions: [], entity_id: 'x', level: 0, metric: 'contracts' }) })
    await flushPromises()
    expect(w.find('[data-testid="enu-loading"]').exists()).toBe(false)
    w.unmount()
  })
})

// ── Tooltip text + colorize regression ────────────────────────────────────────
//
// Two bugs reported together: tooltip on a no-data country said
// "no data" (should read "no known contracts"), AND countries that
// did have contracts were rendered gray + had no tooltip. The latter
// reproduces specifically when every region shares the same value
// (e.g. one country with contracts) — `choroplethBounds` collapses
// to [N, N] and _linearStops produces an invalid step expression, so
// MapLibre silently drops the enu-fill layer.

describe('EntityNutsMap — tooltip & colorize regressions', () => {
  it('tooltip reads "no known contracts" (not "no data") when hovering an empty region', async () => {
    const { default: EntityNutsMap } = await import('../../src/components/EntityNutsMap.vue')
    const w = mount(EntityNutsMap, {
      props: { entityId: 'test-entity-id' },
      attachTo: document.body,
    })
    await flushPromises()

    // Pull the mousemove handler that was attached to the enu-null
    // layer (this is the no-data fill) and fire it with a feature
    // that has nuts_code+name but no `value` property.
    const onCalls = mapInstance.on.mock.calls
    const onMoveCall = onCalls.find(
      (c) => c[0] === 'mousemove' && c[1] === 'enu-null',
    )
    expect(onMoveCall, 'enu-null mousemove handler should be registered').toBeTruthy()
    const onMove = onMoveCall[2]
    onMove({
      features: [{ properties: { nuts_code: 'XK', name: 'Kosovo' } }],
    })
    await flushPromises()

    const hover = w.find('[data-testid="enu-hover"]')
    expect(hover.exists()).toBe(true)
    expect(hover.text()).toContain('Kosovo')
    expect(hover.text()).toContain('no known contracts')
    expect(hover.text()).not.toContain('no data')
    expect(w.find('[data-testid="enu-hover-empty"]').exists()).toBe(true)
    w.unmount()
  })

  it('renders an enu-fill layer even when every region shares the same value', async () => {
    // Degenerate case: one country with value 1, rest unset.
    const ROWS_SINGLE = [
      { nuts_code: 'DK', label: 'Danmark', level: 0, value: 1 },
    ]
    globalThis.fetch = makeFetch(ROWS_SINGLE)
    const { default: EntityNutsMap } = await import('../../src/components/EntityNutsMap.vue')
    const w = mount(EntityNutsMap, {
      props: { entityId: 'test-entity-id' },
      attachTo: document.body,
    })
    await flushPromises()
    const fillCall = mapInstance.addLayer.mock.calls.find((c) => c[0].id === 'enu-fill')
    expect(fillCall).toBeTruthy()
    const fillColor = fillCall[0].paint['fill-color']
    // Pre-fix this was a `step` expression with 4 identical stops
    // → invalid → layer drops. The fix makes it a solid colour
    // string (a single hex). Both are acceptable as long as the
    // expression is well-formed (and visibly distinct from the
    // no-data gray).
    if (Array.isArray(fillColor) && fillColor[0] === 'step') {
      // Must have strictly-increasing stop values.
      const stopValues = []
      for (let i = 3; i < fillColor.length; i += 2) stopValues.push(fillColor[i])
      for (let i = 1; i < stopValues.length; i++) {
        expect(stopValues[i]).toBeGreaterThan(stopValues[i - 1])
      }
    } else {
      expect(typeof fillColor).toBe('string')
      expect(fillColor).toMatch(/^#/)
    }
    w.unmount()
  })

  it('countries with contracts get their value injected into properties', async () => {
    // Same degenerate input — check the join still flows through.
    const ROWS_SINGLE = [
      { nuts_code: 'DK', label: 'Danmark', level: 0, value: 1 },
    ]
    const BOUNDS_WITH_DK = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { nuts_code: 'DK', name: 'Danmark' }, geometry: { type: 'Polygon', coordinates: [[[8,55],[12,55],[12,57],[8,57],[8,55]]] } },
        { type: 'Feature', properties: { nuts_code: 'DE', name: 'Deutschland' }, geometry: { type: 'Polygon', coordinates: [[[5,47],[15,47],[15,55],[5,55],[5,47]]] } },
      ],
    }
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/geo/entity/')) {
        return Promise.resolve({ ok: true, json: async () => ({ entity_id: 'x', level: 0, metric: 'contracts', regions: ROWS_SINGLE }) })
      }
      return Promise.resolve({ ok: true, json: async () => BOUNDS_WITH_DK })
    })
    const { default: EntityNutsMap } = await import('../../src/components/EntityNutsMap.vue')
    const w = mount(EntityNutsMap, {
      props: { entityId: 'test-entity-id' },
      attachTo: document.body,
    })
    await flushPromises()
    const srcCall = mapInstance.addSource.mock.calls.find((c) => c[0] === 'enu')
    const geojson = srcCall[1].data
    const dk = geojson.features.find((f) => f.properties.nuts_code === 'DK')
    const de = geojson.features.find((f) => f.properties.nuts_code === 'DE')
    expect(dk.properties.value).toBe(1)
    // DE had no contracts in the row set → value must be cleared so
    // it falls through to the no-data layer.
    expect(de.properties.value).toBeUndefined()
    w.unmount()
  })
})
