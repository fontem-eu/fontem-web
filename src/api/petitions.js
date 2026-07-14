/**
 * Petitions API client — the graph API's /petitions endpoints.
 * Petition ids contain parentheses, so detail uses query params.
 */
import { withLang } from './_lang.js'

async function get(path) {
  const res = await fetch(withLang(path))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

/** @returns {Promise<{counts, total, results}>} */
export function fetchPetitions({ status, limit = 50, offset = 0 } = {}) {
  const p = new URLSearchParams()
  if (status) p.set('status', status)
  p.set('limit', limit)
  p.set('offset', offset)
  return get(`/api/petitions?${p}`)
}

/** @returns {Promise<{petition, legislation, unresolved_answer_refs}>} */
export function fetchPetitionDetail(petitionId, system = 'eu-eci') {
  const p = new URLSearchParams({ petition_id: petitionId, system })
  return get(`/api/petitions/detail?${p}`)
}
