/**
 * Tests for AtlasView — the Eurostat dataset explorer.
 *
 * Covers:
 * - Empty state when /atlas/datasets returns []
 * - Dataset selector renders grouped by theme
 * - Picking a dataset triggers /atlas/series with nuts_level
 * - NUTS level picker is constrained to the dataset's allowed levels
 * - Year slider is built from the data, defaults to most recent year
 * - Slice picker appears only when there are multiple dim combinations
 * - Selecting a slice + year filters the choropleth rows correctly
 * - Map cleanup on unmount
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

const { mapInstance } = vi.hoisted(() => ({
  mapInstance: {
    addControl: vi.fn(),
    on: vi.fn(),
    once: vi.fn((event, cb) => { if (event === 'load') cb() }),
    addSource: vi.fn(),
    getSource: vi.fn(() => null),
    addLayer: vi.fn(),
    getCanvas: vi.fn(() => ({ style: {} })),
    isStyleLoaded: vi.fn(() => true),
    setPaintProperty: vi.fn(),
    remove: vi.fn(),
  },
}))

// MapLibre rejects a null/undefined container synchronously in real
// usage with "Invalid type: 'container' must be a String or HTMLElement",
// which (because we call `new Map(...)` inside `onMounted`) aborts the
// whole hook and leaves the view stuck on its loading state. Mirror
// that behaviour here so the regression that hit prod can't sneak past
// vitest again — any future ordering mistake fails this test loudly.
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn((opts) => {
      if (!opts || !opts.container) {
        throw new Error(
          "Invalid type: 'container' must be a String or HTMLElement",
        )
      }
      return mapInstance
    }),
    NavigationControl: vi.fn(),
  },
}))
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

const DATASETS = [
  {
    code: 'nama_10r_2gdp', label: 'GDP × NUTS-2', theme: 'economy',
    nuts_levels: [2], time_unit: 'year', enabled: true,
  },
  {
    code: 'demo_r_pjangrp3', label: 'Population × age × sex × NUTS-3',
    theme: 'population', nuts_levels: [2, 3], time_unit: 'year', enabled: true,
  },
  {
    code: 'disabled_one', label: 'Disabled', theme: 'economy',
    nuts_levels: [2], time_unit: 'year', enabled: false,
  },
]

const SERIES_GDP = {
  data: [
    { geo_code: 'DE21', year: 2020, value: 100, dimensions: { unit: 'MIO_EUR' } },
    { geo_code: 'DE21', year: 2021, value: 110, dimensions: { unit: 'MIO_EUR' } },
    { geo_code: 'FR10', year: 2020, value: 200, dimensions: { unit: 'MIO_EUR' } },
    { geo_code: 'FR10', year: 2021, value: 210, dimensions: { unit: 'MIO_EUR' } },
  ],
}

const SERIES_POP = {
  data: [
    { geo_code: 'DE21', year: 2020, value: 5000, dimensions: { sex: 'T', age: 'TOTAL' } },
    { geo_code: 'DE21', year: 2020, value: 2500, dimensions: { sex: 'M', age: 'TOTAL' } },
    { geo_code: 'DE21', year: 2020, value: 2500, dimensions: { sex: 'F', age: 'TOTAL' } },
    { geo_code: 'FR10', year: 2020, value: 9000, dimensions: { sex: 'T', age: 'TOTAL' } },
    { geo_code: 'FR10', year: 2020, value: 4500, dimensions: { sex: 'M', age: 'TOTAL' } },
    { geo_code: 'FR10', year: 2020, value: 4500, dimensions: { sex: 'F', age: 'TOTAL' } },
  ],
}

const BOUNDARIES_L2 = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { nuts_code: 'DE21', name: 'Oberbayern' },
      geometry: { type: 'Polygon', coordinates: [[[11,47],[12,47],[12,48],[11,48],[11,47]]] } },
    { type: 'Feature', properties: { nuts_code: 'FR10', name: 'Île-de-France' },
      geometry: { type: 'Polygon', coordinates: [[[2,48],[3,48],[3,49],[2,49],[2,48]]] } },
  ],
}

const originalFetch = globalThis.fetch

function makeFetch({ datasets = DATASETS, series = SERIES_GDP } = {}) {
  return vi.fn().mockImplementation((url) => {
    if (url.includes('/atlas/datasets')) {
      return Promise.resolve({ ok: true, json: async () => datasets })
    }
    if (url.includes('/atlas/series')) {
      return Promise.resolve({ ok: true, json: async () => series })
    }
    if (url.includes('/geo/nuts-boundaries')) {
      return Promise.resolve({ ok: true, json: async () => BOUNDARIES_L2 })
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

async function mountAtlas(initialPath = '/atlas') {
  const { default: AtlasView } = await import('../../src/views/AtlasView.vue')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/atlas', component: AtlasView }],
  })
  await router.push(initialPath)
  await router.isReady()
  return mount(AtlasView, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
}

describe('AtlasView — empty state', () => {
  it('shows the empty banner when /atlas/datasets returns []', async () => {
    globalThis.fetch = makeFetch({ datasets: [] })
    const w = await mountAtlas()
    await flushPromises()
    expect(w.find('[data-testid="atlas-empty"]').exists()).toBe(true)
    w.unmount()
  })

  it('shows an error banner when /atlas/datasets fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 503, text: async () => 'stats unavailable',
    })
    const w = await mountAtlas()
    await flushPromises()
    expect(w.find('[data-testid="atlas-error"]').exists()).toBe(true)
    w.unmount()
  })
})

describe('AtlasView — dataset picker', () => {
  it('groups enabled datasets by theme and skips disabled', async () => {
    const w = await mountAtlas()
    await flushPromises()
    const sel = w.find('[data-testid="atlas-dataset"]')
    expect(sel.exists()).toBe(true)
    const groups = sel.findAll('optgroup')
    const labels = groups.map((g) => g.attributes('label'))
    expect(labels).toContain('economy')
    expect(labels).toContain('population')
    // Disabled dataset is excluded
    expect(sel.text()).not.toContain('Disabled')
    w.unmount()
  })

  it('seeds selection from the URL query', async () => {
    const w = await mountAtlas('/atlas?dataset=nama_10r_2gdp&level=2')
    await flushPromises()
    const sel = w.find('[data-testid="atlas-dataset"]')
    expect(sel.element.value).toBe('nama_10r_2gdp')
    w.unmount()
  })
})

describe('AtlasView — series fetching', () => {
  it('fetches /atlas/series with nuts_level once a dataset is picked', async () => {
    const w = await mountAtlas()
    await flushPromises()
    await w.find('[data-testid="atlas-dataset"]').setValue('nama_10r_2gdp')
    await flushPromises()
    const calls = globalThis.fetch.mock.calls.map((c) => c[0])
    const seriesCall = calls.find((u) => u.includes('/atlas/series'))
    expect(seriesCall).toBeTruthy()
    expect(seriesCall).toContain('dataset=nama_10r_2gdp')
    expect(seriesCall).toContain('nuts_level=2')
    w.unmount()
  })

  it('fetches NUTS boundaries for the picked level', async () => {
    const w = await mountAtlas()
    await flushPromises()
    await w.find('[data-testid="atlas-dataset"]').setValue('nama_10r_2gdp')
    await flushPromises()
    const calls = globalThis.fetch.mock.calls.map((c) => c[0])
    expect(calls.some((u) => u.includes('/geo/nuts-boundaries?level=2'))).toBe(true)
    w.unmount()
  })

  it('constrains NUTS level options to the dataset.nuts_levels', async () => {
    const w = await mountAtlas()
    await flushPromises()
    // Population dataset allows NUTS 2 and 3
    await w.find('[data-testid="atlas-dataset"]').setValue('demo_r_pjangrp3')
    await flushPromises()
    const sel = w.find('[data-testid="atlas-level"]')
    const values = sel.findAll('option').map((o) => o.element.value)
    expect(values).toEqual(['2', '3'])
    w.unmount()
  })
})

describe('AtlasView — year slider', () => {
  it('builds the slider bounds from the observation years', async () => {
    const w = await mountAtlas()
    await flushPromises()
    await w.find('[data-testid="atlas-dataset"]').setValue('nama_10r_2gdp')
    await flushPromises()
    const slider = w.find('[data-testid="atlas-year"]')
    expect(slider.exists()).toBe(true)
    expect(slider.attributes('min')).toBe('2020')
    expect(slider.attributes('max')).toBe('2021')
    // Defaults to the latest year
    expect(Number(slider.element.value)).toBe(2021)
    w.unmount()
  })
})

describe('AtlasView — slice picker', () => {
  it('hides the slice picker when there is only one dim combo', async () => {
    const w = await mountAtlas()
    await flushPromises()
    await w.find('[data-testid="atlas-dataset"]').setValue('nama_10r_2gdp')
    await flushPromises()
    expect(w.find('[data-testid="atlas-slice"]').exists()).toBe(false)
    w.unmount()
  })

  it('shows the slice picker when multiple dim combos exist', async () => {
    globalThis.fetch = makeFetch({ series: SERIES_POP })
    const w = await mountAtlas()
    await flushPromises()
    await w.find('[data-testid="atlas-dataset"]').setValue('demo_r_pjangrp3')
    await flushPromises()
    const slicePicker = w.find('[data-testid="atlas-slice"]')
    expect(slicePicker.exists()).toBe(true)
    const opts = slicePicker.findAll('option')
    expect(opts.length).toBe(3) // sex=T, sex=M, sex=F
    w.unmount()
  })
})

describe('AtlasView — coverage filters', () => {
  // Catalog rows with explicit max_availability_pct so the
  // dataset-level filter has something to chew on.
  const COV_DATASETS = [
    {
      code: 'rich', label: 'Rich coverage', theme: 'economy',
      nuts_levels: [2], time_unit: 'year', enabled: true,
      max_availability_pct: 0.95,
    },
    {
      code: 'sparse', label: 'Sparse coverage', theme: 'economy',
      nuts_levels: [2], time_unit: 'year', enabled: true,
      max_availability_pct: 0.10,
    },
    {
      code: 'unknown', label: 'Pre-backfill', theme: 'economy',
      nuts_levels: [2], time_unit: 'year', enabled: true,
      max_availability_pct: null,
    },
  ]

  // Per-(level, slice, year) availability for the 'rich' dataset:
  // 2020 covers 90%, 2021 covers 8% (low-coverage year).
  const COV_AVAILABILITY = [
    {
      nuts_level: 2, dimensions: { unit: 'MIO_EUR' }, year: 2020,
      regions_with_value: 252, regions_total: 281, availability_pct: 0.897,
    },
    {
      nuts_level: 2, dimensions: { unit: 'MIO_EUR' }, year: 2021,
      regions_with_value: 22, regions_total: 281, availability_pct: 0.078,
    },
  ]

  function makeCovFetch() {
    return vi.fn().mockImplementation((url) => {
      // Path-prefix dispatch — `/atlas/datasets` matches the catalog
      // AND the per-dataset endpoints, so check the suffix first to
      // pick off slice-stats and availability before the catalog hit.
      if (url.includes('/availability')) {
        return Promise.resolve({ ok: true, json: async () => COV_AVAILABILITY })
      }
      if (url.includes('/slice-stats')) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      if (url.includes('/atlas/datasets')) {
        return Promise.resolve({ ok: true, json: async () => COV_DATASETS })
      }
      if (url.includes('/atlas/series')) {
        return Promise.resolve({ ok: true, json: async () => SERIES_GDP })
      }
      if (url.includes('/geo/nuts-boundaries')) {
        return Promise.resolve({ ok: true, json: async () => BOUNDARIES_L2 })
      }
      return Promise.resolve({ ok: false, status: 404, text: async () => 'not found' })
    })
  }

  it('hides datasets whose max_availability_pct is below the threshold by default', async () => {
    globalThis.fetch = makeCovFetch()
    const w = await mountAtlas()
    await flushPromises()
    const opts = w.find('[data-testid="atlas-dataset"]').findAll('option')
    const codes = opts.map((o) => o.element.value)
    // Sparse one is hidden; rich + unknown (null pct → show) remain.
    expect(codes).toContain('rich')
    expect(codes).toContain('unknown')
    expect(codes).not.toContain('sparse')
    // Hint reports the count of hidden datasets.
    const datasetToggle = w.find('[data-testid="atlas-hide-low-datasets"]')
    expect(datasetToggle.element.checked).toBe(true)
    w.unmount()
  })

  it('reveals low-coverage datasets when the toggle is flipped off', async () => {
    globalThis.fetch = makeCovFetch()
    const w = await mountAtlas()
    await flushPromises()
    await w.find('[data-testid="atlas-hide-low-datasets"]').setValue(false)
    const codes = w.find('[data-testid="atlas-dataset"]').findAll('option')
      .map((o) => o.element.value)
    expect(codes).toContain('sparse')
    w.unmount()
  })

  it('hides low-coverage years from the slider after a dataset is picked', async () => {
    globalThis.fetch = makeCovFetch()
    const w = await mountAtlas()
    await flushPromises()
    await w.find('[data-testid="atlas-dataset"]').setValue('rich')
    await flushPromises()
    const slider = w.find('[data-testid="atlas-year"]')
    // 2021 is the low-coverage year (≈8%) → slider clamps to 2020.
    expect(slider.attributes('min')).toBe('2020')
    expect(slider.attributes('max')).toBe('2020')
    expect(Number(slider.element.value)).toBe(2020)
    w.unmount()
  })

  it('keeps low-coverage years on the slider when the toggle is off', async () => {
    globalThis.fetch = makeCovFetch()
    const w = await mountAtlas()
    await flushPromises()
    await w.find('[data-testid="atlas-dataset"]').setValue('rich')
    await flushPromises()
    await w.find('[data-testid="atlas-hide-low-years"]').setValue(false)
    await flushPromises()
    const slider = w.find('[data-testid="atlas-year"]')
    expect(slider.attributes('max')).toBe('2021')
    w.unmount()
  })
})

describe('AtlasView — map cleanup', () => {
  it('removes the map on unmount', async () => {
    const w = await mountAtlas()
    await flushPromises()
    w.unmount()
    expect(mapInstance.remove).toHaveBeenCalled()
  })
})

describe('AtlasView — mount order (regression for stuck-loading bug)', () => {
  it('does not instantiate the map before the body has rendered', async () => {
    const { Map } = (await import('maplibre-gl')).default
    const w = await mountAtlas()
    // At this exact moment fetchDatasets is in-flight; the body
    // (with the map container div) is NOT in the DOM yet.
    expect(Map).not.toHaveBeenCalled()
    await flushPromises()
    // After datasets resolve and the body renders, the map mounts.
    expect(Map).toHaveBeenCalledTimes(1)
    // Container must be a real element — the mock asserts this too,
    // but we double-check the explicit value here so failures are
    // self-explanatory in the test output.
    const container = Map.mock.calls[0][0].container
    expect(container).toBeTruthy()
    expect(container.tagName).toBe('DIV')
    w.unmount()
  })

  it('still resolves loading state when the API succeeds', async () => {
    // Direct repro of the stuck-loading bug: if the map setup throws,
    // the old onMounted aborted before flipping datasetsLoading=false,
    // leaving the loading spinner on screen forever.
    const w = await mountAtlas()
    expect(w.find('[data-testid="atlas-loading"]').exists()).toBe(true)
    await flushPromises()
    expect(w.find('[data-testid="atlas-loading"]').exists()).toBe(false)
    expect(w.find('[data-testid="atlas-dataset"]').exists()).toBe(true)
    w.unmount()
  })

  it('does not instantiate the map when datasets is empty', async () => {
    const { Map } = (await import('maplibre-gl')).default
    globalThis.fetch = makeFetch({ datasets: [] })
    const w = await mountAtlas()
    await flushPromises()
    // Empty state shows the "register-seed" hint — no body, no map.
    expect(w.find('[data-testid="atlas-empty"]').exists()).toBe(true)
    expect(Map).not.toHaveBeenCalled()
    w.unmount()
  })
})
