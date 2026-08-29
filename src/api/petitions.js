/**
 * Petitions API client — the graph API's /petitions endpoints.
 * Petition ids contain parentheses, so detail uses query params.
 */
import { withLang } from './_lang.js'
import { fetchRetrying } from './_retry.js'

async function get(path) {
  const res = await fetchRetrying(withLang(path))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * @param {object} [opts]
 * @param {string} [opts.status]   single exact status (register vocabulary)
 * @param {string} [opts.statuses] comma-separated set; takes precedence server-side
 * @param {string} [opts.sort]     'supporters' (default) or 'recent'
 * @returns {Promise<{counts, total, results}>}
 */
export function fetchPetitions({ status, statuses, sort, limit = 50, offset = 0 } = {}) {
  const p = new URLSearchParams()
  if (status) p.set('status', status)
  if (statuses) p.set('statuses', statuses)
  if (sort) p.set('sort', sort)
  p.set('limit', limit)
  p.set('offset', offset)
  return get(`/api/petitions?${p}`)
}

/** @returns {Promise<{petition, legislation, unresolved_answer_refs}>} */
export function fetchPetitionDetail(petitionId, system = 'eu-eci') {
  const p = new URLSearchParams({ petition_id: petitionId, system })
  return get(`/api/petitions/detail?${p}`)
}
