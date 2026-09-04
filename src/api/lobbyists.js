import { withLang } from './_lang.js'
import { fetchRetrying } from './_retry.js'

const BASE = '/api/lobbyists'

/**
 * One EU Transparency Register entry.
 *
 * Keyed by disclosure_id (e.g. '763743132433-49') because that is the
 * only identifier these records carry — they have no gmr_id.
 *
 * @param {string} disclosureId
 * @returns {Promise<object>} the registrant profile
 */
export async function getLobbyist(disclosureId) {
  const url = `${BASE}/${encodeURIComponent(disclosureId)}`
  const res = await fetchRetrying(withLang(url))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}
