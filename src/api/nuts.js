/**
 * The NUTS reference API — region names in the 24 EU languages.
 *
 * `/api/nuts` is a published surface other people's code calls too, which is
 * why this app uses it rather than a private endpoint shaped for the app:
 * one implementation of the lookup, one ranking, one thing to keep correct.
 *
 * It replaced `/api/geo/nuts-regions` and `/api/geo/nuts-search-index`. The
 * second is the bigger change — the old picker downloaded a folded index and
 * ranked matches in the browser, so the same ranking existed twice and the
 * two folding implementations had to agree character for character. Search
 * happens on the server now.
 */

import { withLang } from './_lang.js'
import { fetchRetrying } from './_retry.js'

async function _json(url, { signal } = {}) {
  const res = await fetchRetrying(withLang(url), signal ? { signal } : undefined)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * The region list, named in the reader's language.
 *
 * `names=none` drops the other 23 languages and the aliases — this app shows
 * one language at a time, and they are most of the payload (393 KB against
 * 1.2 MB). `limit` is above the size of the classification on purpose: the
 * whole thing arrives in one call.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.codes] only these codes — for labelling a handful
 * @param {number} [opts.maxLevel] deepest level to return; 0 is countries
 * @returns {Promise<{regions: {code:string, name:string, level:number,
 *   name_latn:string, name_native:string, name_source:string,
 *   country:string, parent:string|null}[]}>}
 */
export async function fetchNutsRegions({ codes, maxLevel } = {}) {
  const params = new URLSearchParams({ names: 'none', limit: '5000' })
  if (codes !== undefined) {
    // An empty selection means "none", and the server agrees — but there is
    // no point paying for the round trip to be told so.
    if (!codes.length) return { regions: [] }
    params.set('codes', codes.join(','))
  }
  if (maxLevel !== undefined) params.set('max_level', String(maxLevel))
  return _json(`/api/nuts/regions?${params.toString()}`)
}

/**
 * Name → regions, ranked, in any of the 24 languages.
 *
 * Each match reports which form matched and in which language, so the UI can
 * say why "Lisbonne" produced PT1A0 rather than asking the reader to trust it.
 *
 * @param {string} query
 * @param {object} [opts]
 * @param {number} [opts.maxLevel]
 * @param {number} [opts.limit]
 * @param {AbortSignal} [opts.signal] aborts a query the user has typed past
 * @returns {Promise<{matches: {code:string, name:string, name_native:string,
 *   level:number, matched:string, matched_language:string|null,
 *   matched_kind:string, rank:number}[]}>}
 */
export async function searchNutsRegions(query, { maxLevel, limit = 40, signal } = {}) {
  const term = (query || '').trim()
  if (!term) return { matches: [] }
  const params = new URLSearchParams({ q: term, limit: String(limit) })
  if (maxLevel !== undefined) params.set('max_level', String(maxLevel))
  return _json(`/api/nuts/search?${params.toString()}`, { signal })
}
