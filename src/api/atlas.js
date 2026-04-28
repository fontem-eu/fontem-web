/**
 * Atlas API client — datasets + series + snapshot from the Fontem
 * Atlas API (edgar-gmr-etl/src/atlas_api/).
 *
 * Mounted at /api/atlas/* in the consolidated build; if the API ever
 * gets extracted to its own service, this client only needs the
 * BASE swap below.
 */

import { withLang } from './_lang.js'

// One place to change if Atlas moves to its own host. Today the API
// lives in the gmr-api image, fronted by the same nginx; flipping
// this to an absolute origin (e.g. https://atlas.void42.internal)
// will route around it cleanly.
const BASE = '/api/atlas'

async function _json(url) {
  const res = await fetch(withLang(url))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * Atlas API + downstream-source health. Returns 200 always; body
 * status is `ok` when every source is reachable, else `degraded`.
 */
export async function fetchHealth() {
  return _json(`${BASE}/health`)
}

/**
 * List every enabled dataset + last successful sync. Used by the
 * Atlas dataset picker.
 */
export async function fetchDatasets() {
  return _json(`${BASE}/datasets`)
}

/**
 * One dataset's full metadata + observed time range + dim-combo count.
 */
export async function fetchDatasetDetail(code) {
  if (!code) throw new Error('fetchDatasetDetail: code is required')
  return _json(`${BASE}/datasets/${encodeURIComponent(code)}`)
}

/**
 * Time-series rows for one dataset.
 *
 * Supply either `geo` (one or more NUTS codes) or `nutsLevel` (0..3
 * to pull every region at that level).
 */
export async function fetchSeries({
  dataset, geo, nutsLevel, start, end, dimensions,
} = {}) {
  if (!dataset) throw new Error('fetchSeries: dataset is required')
  if ((!geo || !geo.length) && nutsLevel == null) {
    throw new Error('fetchSeries: supply either geo or nutsLevel')
  }
  const params = new URLSearchParams()
  params.set('dataset', dataset)
  if (geo && geo.length) {
    for (const code of geo) params.append('geo', code)
  }
  if (nutsLevel != null) params.set('nuts_level', String(nutsLevel))
  if (start != null) params.set('start', String(start))
  if (end != null) params.set('end', String(end))
  if (dimensions && Object.keys(dimensions).length > 0) {
    params.set('dimensions', JSON.stringify(dimensions))
  }
  return _json(`${BASE}/series?${params.toString()}`)
}

/**
 * Choropleth-shaped query: one value per geo for (dataset, year,
 * nutsLevel). The response also lists every other dim combination
 * present at that slice so the UI can offer a slice picker without
 * a second round-trip.
 *
 * If `dimensions` is omitted and the dataset has multiple combos at
 * that (year, level), `cells` comes back empty and the caller should
 * read `available_dim_combos` and pick one.
 */
export async function fetchSnapshot({
  dataset, year, nutsLevel, dimensions,
} = {}) {
  if (!dataset) throw new Error('fetchSnapshot: dataset is required')
  if (year == null) throw new Error('fetchSnapshot: year is required')
  if (nutsLevel == null) throw new Error('fetchSnapshot: nutsLevel is required')
  const params = new URLSearchParams()
  params.set('dataset', dataset)
  params.set('year', String(year))
  params.set('nuts_level', String(nutsLevel))
  if (dimensions && Object.keys(dimensions).length > 0) {
    params.set('dimensions', JSON.stringify(dimensions))
  }
  return _json(`${BASE}/snapshot?${params.toString()}`)
}
