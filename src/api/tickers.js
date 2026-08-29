import { withLang } from './_lang.js'
import { fetchRetrying } from './_retry.js'

const BASE = '/api/tickers'

/**
 * Search tickers by name or symbol (legacy endpoint).
 * @param {string} query
 * @param {number} limit  max results (default 10, max 50)
 * @returns {Promise<{query: string, results: object[], count: number, total_available: number}>}
 */
export async function searchTickers(query, limit = 10) {
  if (!query?.trim()) {
    return { query: query ?? '', results: [], count: 0, total_available: 0 }
  }
  const url = `${BASE}/search?query=${encodeURIComponent(query.trim())}&limit=${limit}`
  const res = await fetchRetrying(withLang(url))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * Unified search across companies and authorities.
 * @param {string} query
 * @param {number} limit  max results per entity type
 * @returns {Promise<{query: string, companies: object[], authorities: object[]}>}
 */
export async function searchAll(query, limit = 10) {
  if (!query?.trim()) {
    return { query: query ?? '', companies: [], authorities: [] }
  }
  const url = `/api/search?q=${encodeURIComponent(query.trim())}&limit=${limit}`
  const res = await fetchRetrying(withLang(url))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}
