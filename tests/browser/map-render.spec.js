/**
 * Region maps must actually draw their regions — in a real browser, from the
 * built bundle.
 *
 * Why this exists: on 2026-09-10 maplibre-gl went 5 -> 6. v6 loads its web
 * worker from a separate file that our build did not emit, so the request
 * 404'd. The raster basemap needs no worker and kept drawing; every GeoJSON
 * region layer silently never appeared. No exception, no console error, and
 * every unit test stayed green because they all mock maplibre. Users got
 * empty maps on Atlas, Geo and every embed.
 *
 * So these tests mock nothing of the map stack. They stub only the network,
 * then prove a region was rendered the way a user would: point at it and
 * read the tooltip. The tooltip is fed by maplibre's rendered-feature query,
 * which only answers once the worker has tiled the GeoJSON and the fill layer
 * has been drawn.
 */
import { test, expect } from '@playwright/test'

// One square "country" under the map's initial centre ([10, 51], zoom 3),
// plus one with no value so Atlas's no-data layer is exercised too.
const square = (w, s, e, n) => [[[w, s], [e, s], [e, n], [w, n], [w, s]]]
const BOUNDARIES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { nuts_code: 'TL', name: 'Testland', country_a3: 'TLD' },
      geometry: { type: 'Polygon', coordinates: square(0, 44, 20, 58) },
    },
    {
      type: 'Feature',
      properties: { nuts_code: 'NV', name: 'Novalue', country_a3: 'NVL' },
      geometry: { type: 'Polygon', coordinates: square(24, 44, 40, 58) },
    },
  ],
}

const DIMS = { unit: 'NR' }
const DATASET = {
  code: 'test_ds', label: 'Test dataset', theme: 'test', nuts_levels: [0],
  time_unit: 'year', update_freq: '1 year', enabled: true, notes: null,
  last_sync_started_at: '2026-01-01T00:00:00Z', last_upstream_modified: '2026-01-01T00:00:00Z',
  last_sync_rows: 1, dim_ids: ['unit', 'geo', 'time'],
  dim_labels: { unit: { NR: 'Number' }, geo: { TL: 'Testland' } },
}
const API = {
  '/api/geo/nuts-boundaries': BOUNDARIES,
  '/api/atlas/datasets/test_ds/slice-stats': [{
    dimensions: DIMS, value_min: 0, value_max: 100, value_p02: 0, value_p50: 50,
    value_p98: 100, observation_count: 1, value_kind: 'sequential', skew_ratio: 1,
  }],
  '/api/atlas/datasets/test_ds/availability': [{
    nuts_level: 0, dimensions: DIMS, year: 2020,
    regions_with_value: 1, regions_total: 1, availability_pct: 1,
  }],
  '/api/atlas/datasets/test_ds': DATASET,
  '/api/atlas/datasets': [DATASET],
  '/api/atlas/series': {
    dataset: 'test_ds', geo: null, nuts_level: 0, start: null, end: null,
    dimensions_filter: null, count: 1, truncated: false,
    data: [{ geo_code: 'TL', year: 2020, time: '2020-01-01T00:00:00Z', dimensions: DIMS, value: 42, flags: null }],
  },
}

// 1×1 grey PNG (a valid one — maplibre treats an undecodable tile as a
// failed tile): basemap requests never leave the machine.
const TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4e/cuAAUyApjDDfqPAAAAAElFTkSuQmCC',
  'base64',
)

/** Stub the network; return what the page did with the map worker. */
async function stubNetwork(page, { tiles = 'ok' } = {}) {
  const worker = { requested: [], failed: [] }
  page.on('response', (r) => {
    if (!/maplibre-gl-worker/.test(r.url())) return
    worker.requested.push(r.url())
    // Status alone proves nothing: an SPA fallback answers a missing file
    // with index.html and a 200. The worker must come back as a script.
    const type = r.headers()['content-type'] || ''
    if (!r.ok() || !/javascript/.test(type)) worker.failed.push(`${r.status()} ${type} ${r.url()}`)
  })
  await page.route(/tile\.openstreetmap\.org/, (route) =>
    tiles === 'down' ? route.abort() : route.fulfill({ status: 200, contentType: 'image/png', body: TILE }))
  await page.route(/\/(api|capi)\//, (route) => {
    const path = new URL(route.request().url()).pathname
    // Longest prefix first, so /datasets/test_ds/slice-stats beats /datasets.
    const key = Object.keys(API).sort((a, b) => b.length - a.length).find((k) => path.startsWith(k))
    if (key) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(API[key]) })
    return route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"stubbed"}' })
  })
  return worker
}

/** Point at the middle of the map — inside Testland — and wait for a tooltip. */
async function hoverMapCentre(page, mapLocator, tooltip) {
  const box = await mapLocator.boundingBox()
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
  // Rendering is asynchronous (worker tiling, then a frame), so keep nudging
  // the pointer until the tooltip answers rather than sleeping a fixed time.
  await expect(async () => {
    await page.mouse.move(x + 3, y + 3)
    await page.mouse.move(x, y)
    await expect(tooltip).toBeVisible({ timeout: 500 })
  }).toPass({ timeout: 30_000 })
}

test.describe('region maps render their regions', () => {
  test('the map worker is part of the build and loads', async ({ page }) => {
    const worker = await stubNetwork(page)
    await page.goto('/map')
    await expect(page.locator('[data-testid="atlas-map"] canvas')).toBeVisible()
    await expect.poll(() => worker.requested.length, { timeout: 30_000 }).toBeGreaterThan(0)
    expect(worker.failed).toEqual([])
  })

  // The basemap is a third party's server. When it is down, rate-limiting us
  // or blocked by the visitor's browser, maplibre never fires `load` — and the
  // maps used to wait for `load` before painting, so our own data vanished
  // along with the background.
  test('Atlas: regions are drawn even when the basemap tiles fail', async ({ page }) => {
    await stubNetwork(page, { tiles: 'down' })
    const slice = encodeURIComponent(JSON.stringify(DIMS))
    await page.goto(`/map?dataset=test_ds&level=0&year=2020&slice=${slice}`)
    const tooltip = page.getByTestId('atlas-hover')
    await hoverMapCentre(page, page.locator('[data-testid="atlas-map"] canvas'), tooltip)
    await expect(tooltip).toContainText('Testland')
  })

  test('Atlas: the selected dataset colours its region and answers hover', async ({ page }) => {
    await stubNetwork(page)
    const slice = encodeURIComponent(JSON.stringify(DIMS))
    await page.goto(`/map?dataset=test_ds&level=0&year=2020&slice=${slice}`)
    const tooltip = page.getByTestId('atlas-hover')
    await hoverMapCentre(page, page.locator('[data-testid="atlas-map"] canvas'), tooltip)
    await expect(tooltip).toContainText('Testland')
    await expect(tooltip).toContainText('42')
  })
})
