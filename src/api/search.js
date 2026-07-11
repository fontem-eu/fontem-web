/**
 * Unified search client for the /search results page.
 *
 * Fans out to the two backends the platform exposes:
 *   - the graph API (`/api/search/results`) for companies, public bodies,
 *     people, lobbyists, contracts, cohesion projects and sanctioned entities;
 *   - the community API (`/capi/data-stories/search`) for public data stories,
 *     which is visibility-aware for the signed-in viewer.
 *
 * Callers (SearchView) run both in parallel and merge the typed results.
 */
import { withLang } from './_lang.js'
import { request } from './community.js'

// Build a query string, dropping empty/absent values and joining arrays with
// commas (the `types` facet the graph endpoint expects).
function qs(params) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) {
      if (v.length) p.set(k, v.join(','))
    } else {
      p.set(k, v)
    }
  }
  return p.toString()
}

/**
 * Faceted keyword search over graph entities.
 * @returns {Promise<{query,types,counts,results,has_more,total_shown}>}
 */
export async function searchGraph({
  q, types, country, nuts, dateFrom, dateTo, limit = 20, offset = 0,
}) {
  if (!q?.trim()) return { query: '', types: [], counts: {}, results: [], has_more: false }
  const query = qs({
    q: q.trim(), types, country, nuts,
    date_from: dateFrom, date_to: dateTo, limit, offset,
  })
  const res = await fetch(withLang(`/api/search/results?${query}`))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * Visibility-aware keyword search over public data stories.
 * @returns {Promise<object[]>} report summary dicts
 */
export async function searchStories({ q, dateFrom, dateTo, limit = 20, offset = 0 }) {
  if (!q?.trim()) return []
  const query = qs({ q: q.trim(), date_from: dateFrom, date_to: dateTo, limit, offset })
  return request('GET', `/data-stories/search?${query}`)
}
