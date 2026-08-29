/**
 * Public Spending API client — country detection + recommendations.
 *
 * Endpoints land at `/api/euro-tracker/*` in production (gmr-api
 * mounts `/euro-tracker` at the root of the FastAPI app; `/api` is
 * the proxy prefix).
 */
import { withLang } from './_lang.js'
import { fetchRetrying } from './_retry.js'

const BASE = '/api/euro-tracker'

async function _json(url) {
  const res = await fetchRetrying(withLang(url))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * Best-effort IP → alpha-3 country.
 *
 * Returns `{ country, source, geoip_unavailable_reason }`.
 *   country: 'PRT' | null
 *   source:  'geoip' | 'unknown'
 *
 * `country: null` is the contract for "we don't know" — UI falls
 * back to a country picker without having to discriminate between
 * "DB missing", "private IP", or "IP not in DB".
 */
export async function fetchMyCountry() {
  return _json(`${BASE}/me/country`)
}

/**
 * Top-N companies (HQ in country) + top-N authorities, both ranked
 * by total contract EUR. Returns:
 *   { country, companies: [...], authorities: [...] }
 */
export async function fetchRecommendations(country, { limit = 10 } = {}) {
  if (!country) throw new Error('fetchRecommendations: country is required')
  const params = new URLSearchParams({ country, limit: String(limit) })
  return _json(`${BASE}/recommendations?${params.toString()}`)
}
