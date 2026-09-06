/**
 * Human-readable place names for NUTS codes, as a chain.
 *
 * A briefing item carries a bare code — `CZ010` — which answers "where"
 * only for someone who reads NUTS. The chain to a reader is
 * "Hlavní město Praha › Praha › Česko": the NUTS-3 region, then the 2,
 * then the 1.
 *
 * The hierarchy needs no lookup. A NUTS code is its own path: a child's
 * code is its parent's plus a character, so CZ010 -> CZ01 -> CZ0 falls
 * out of string slicing. Only the NAMES have to be fetched, and only for
 * the codes actually on screen — the full catalogue is 91 KB, which is
 * not a reasonable price for three labels on a feed card.
 */
import { fetchNutsRegions } from '../api/geo.js'

/** code -> name, accumulated across calls. */
const cache = new Map()
/** In-flight requests, so ten cards mounting at once make one call. */
let pending = null

/**
 * The codes whose names are needed to label `code`, longest first.
 *
 * NUTS-3 is five characters, NUTS-2 four, NUTS-1 three. Anything shorter
 * is already a country or the synthetic 'EU', and has no chain to walk.
 */
export function chainFor(code) {
  const c = String(code || '').trim().toUpperCase()
  if (c.length < 5) return c ? [c] : []
  return [c.slice(0, 5), c.slice(0, 4), c.slice(0, 3)]
}

/**
 * Fetch and cache the names for every code these items sit in.
 * @param {{nuts?: string[]}[]} items
 */
export async function loadNutsLabels(items) {
  const needed = new Set()
  for (const item of items || []) {
    for (const code of item?.nuts || []) {
      for (const part of chainFor(code)) {
        if (!cache.has(part)) needed.add(part)
      }
    }
  }
  if (!needed.size) return
  // Coalesce concurrent callers onto one request rather than firing a
  // near-identical one per card.
  const codes = [...needed]
  pending = (pending || Promise.resolve()).then(async () => {
    const { regions } = await fetchNutsRegions(codes)
    for (const r of regions || []) cache.set(r.code, r.name)
    // Remember the misses too. A code the catalogue does not carry — 'EU',
    // a retired vintage — must not be re-requested on every render.
    for (const c of codes) if (!cache.has(c)) cache.set(c, null)
  }).catch(() => {
    // A missing label is not worth failing a feed over; the card falls
    // back to the raw code, which is still more than nothing.
  })
  await pending
}

/**
 * The readable place chain for an item, e.g.
 * "Hlavní město Praha › Praha › Česko".
 *
 * Consecutive duplicates are dropped: several countries name a NUTS-1 the
 * same as its NUTS-2 (Ireland's "Ireland › Ireland"), and repeating it
 * reads like a bug rather than a hierarchy.
 *
 * @param {{nuts?: string[]}} item
 * @returns {string} empty when nothing is known
 */
export function nutsLabel(item) {
  const code = (item?.nuts || [])[0]
  if (!code) return ''
  const parts = []
  for (const c of chainFor(code)) {
    const name = cache.get(c)
    if (!name) continue
    if (parts[parts.length - 1] !== name) parts.push(name)
  }
  // Names only, never a mix. An unresolved leaf beside a resolved
  // ancestor renders as "PT165 › Continente", which reads as neither a
  // code nor a place. When nothing in the chain has a name the bare code
  // is all there is, and it is still better than an empty cell.
  return parts.length ? parts.join(' › ') : String(code).trim().toUpperCase()
}

/** Test seam: forget everything fetched so far. */
export function _resetNutsLabelsForTests() {
  cache.clear()
  pending = null
}
