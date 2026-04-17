/**
 * Geo API — choropleth aggregation + NUTS boundary GeoJSON.
 *
 * Mirrors the backend routes in edgar-gmr-etl/src/api/routers/geo.py.
 */

async function _json(url) {
  const res = await fetch(url)
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
 * Only level 0 is bundled today; levels 1–3 return 501 until the geometry
 * is sourced.
 */
export async function fetchBoundaries(level = 0) {
  return _json(`/api/geo/nuts-boundaries?level=${level}`)
}
