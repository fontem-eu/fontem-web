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
import { fetchRetrying } from './_retry.js'
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

// The search index names cohesion grants after their disclosure system,
// `eu_cohesion`; this page, its facet chips and its labels call them
// `cohesion`. Unmapped, the type filter the page always sends never matched
// a grant, so no search on the site could find one (prod, 2026-10-03: "port"
// with the page's types returned 0 grants; with none, 3).
const TO_API_TYPE = { cohesion: 'eu_cohesion' }
const FROM_API_TYPE = { eu_cohesion: 'cohesion' }

function fromApi(body) {
  const results = (body.results || []).map((r) => ({ ...r, type: FROM_API_TYPE[r.type] || r.type }))
  const counts = {}
  for (const [type, n] of Object.entries(body.counts || {})) {
    const ui = FROM_API_TYPE[type] || type
    counts[ui] = (counts[ui] || 0) + n
  }
  return { ...body, results, counts }
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
    q: q.trim(), types: types?.map((t) => TO_API_TYPE[t] || t), country, nuts,
    date_from: dateFrom, date_to: dateTo, limit, offset,
  })
  const res = await fetchRetrying(withLang(`/api/search/results?${query}`))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return fromApi(await res.json())
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
