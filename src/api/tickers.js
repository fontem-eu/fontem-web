const BASE = '/api/tickers'

/**
 * Search tickers by name or symbol.
 * @param {string} query
 * @param {number} limit  max results (default 10, max 50)
 * @returns {Promise<{query: string, results: object[], count: number, total_available: number}>}
 */
export async function searchTickers(query, limit = 10) {
  if (!query || !query.trim()) {
    return { query: query ?? '', results: [], count: 0, total_available: 0 }
  }
  const url = `${BASE}/search?query=${encodeURIComponent(query.trim())}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
