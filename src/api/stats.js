/**
 * Stats API — Eurostat (and other NUTS-keyed) datasets from the
 * fontem_stats Postgres+Timescale store.
 *
 * Mirrors the backend routes in edgar-gmr-etl/src/api/routers/stats.py.
 */

import { withLang } from './_lang.js'

async function _json(url) {
  const res = await fetch(withLang(url))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * List every catalog row plus its last-sync metadata. The Atlas UI uses
 * this to populate the dataset picker; the DQ dashboard uses it for the
 * freshness panel.
 *
 * Shape per row: { code, label, theme, nuts_levels, time_unit,
 *                  update_freq, enabled, notes,
 *                  last_sync_started_at, last_upstream_modified,
 *                  last_sync_rows }
 */
export async function fetchDatasets() {
  return _json('/api/stats/datasets')
}

/**
 * Fetch a time-series for one dataset.
 *
 * Supply either `geo` (one or more NUTS codes) or `nutsLevel` (0..3 to
 * pull every region at that level). The Atlas choropleth uses the level
 * form; report widgets that focus on a known set of regions use the
 * geo-list form.
 *
 * @param {object} opts
 * @param {string} opts.dataset — dataset code (e.g. 'nama_10r_2gdp')
 * @param {string[]} [opts.geo] — explicit NUTS codes
 * @param {number} [opts.nutsLevel] — 0..3, mutually exclusive with `geo`
 * @param {number} [opts.start] — inclusive start year
 * @param {number} [opts.end] — inclusive end year
 * @param {object} [opts.dimensions] — JSONB filter, e.g. {sex:'T', age:'TOTAL'}
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
  return _json(`/api/stats/series?${params.toString()}`)
}
