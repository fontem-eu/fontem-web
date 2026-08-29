/**
 * Geo API — choropleth aggregation + NUTS boundary GeoJSON.
 *
 * Mirrors the backend routes in edgar-gmr-etl/src/api/routers/geo.py.
 */

import { withLang } from './_lang.js'
import { fetchRetrying } from './_retry.js'

async function _json(url) {
  const res = await fetchRetrying(withLang(url))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * Aggregate a metric across NUTS regions.
 *
 * @param {object} opts
 * @param {number} [opts.level=0]  — NUTS level 0..3. Level 3 requires scopeNuts.
 * @param {string} [opts.metric='companies']
 *        'companies' | 'contracts' | 'contracts_eur'
 * @param {string} [opts.scopeNuts]  — required when level=3 (NUTS 1 ancestor)
 * @param {string} [opts.connectedToCountry]  — alpha-3 (e.g. 'RUS')
 */
export async function fetchAggregate({
  level = 0,
  metric = 'companies',
  scopeNuts,
  connectedToCountry,
} = {}) {
  const params = new URLSearchParams({ level: String(level), metric })
  if (scopeNuts) params.set('scope_nuts', scopeNuts)
  if (connectedToCountry) params.set('connected_to_country', connectedToCountry)
  return _json(`/api/geo/aggregate?${params.toString()}`)
}

/**
 * Fetch NUTS boundary GeoJSON for a level.
 */
export async function fetchBoundaries(level = 0) {
  return _json(`/api/geo/nuts-boundaries?level=${level}`)
}

/**
 * Fetch the flat, geometry-free list of NUTS regions (code, name, level)
 * across all levels — for the cascading region picker.
 * @returns {Promise<{regions: {code:string, name:string, level:number}[]}>}
 */
export async function fetchNutsRegions() {
  return _json('/api/geo/nuts-regions')
}

/**
 * Coarse home-region guess (NUTS-0 country) from the caller's IP — used to
 * seed the profile "where you're from" default when the user hasn't set one.
 * @returns {Promise<{country_alpha3: string|null, nuts0: string|null}>}
 */
export async function fetchClientRegion() {
  return _json('/api/geo/client-region')
}

/**
 * Aggregate one entity's contract volume by NUTS region.
 *
 * @param {string} entityId  — gmr_id (Company) or authority_id (Authority)
 * @param {object} opts
 * @param {number} [opts.level=0]   — NUTS level 0..3
 * @param {string} [opts.metric='contracts']  — 'contracts' | 'contracts_eur'
 * @param {string} [opts.scopeNuts]  — ancestor NUTS code prefix filter
 */
export async function fetchEntityAggregate(entityId, {
  level = 0,
  metric = 'contracts',
  scopeNuts,
} = {}) {
  const params = new URLSearchParams({ level: String(level), metric })
  if (scopeNuts) params.set('scope_nuts', scopeNuts)
  return _json(`/api/geo/entity/${encodeURIComponent(entityId)}/aggregate?${params.toString()}`)
}
