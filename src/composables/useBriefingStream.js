/**
 * The briefing items a given reader should see, signed in or not.
 *
 * One place, because there are now two callers with the same question
 * and only the source of the watches differs:
 *   - signed in  → the watches you actually configured
 *   - signed out → a public default, so the feed is not empty for
 *                  someone who has never subscribed to anything
 *
 * The signed-out default is deliberately small and local-first: ten a
 * week of public investment from the country we can see you connecting
 * from, and three a week from the EU as a whole. A local award and a
 * European one are different kinds of news, which is why they are two
 * watches at different volumes rather than one bigger number.
 *
 * Region detection is country-level (NUTS-0) and that is the floor, not
 * a shortcut: /api/geo/client-region resolves the country from the IP
 * against a local database and does not log or store it. Anything finer
 * would be a different privacy posture, not just a different query.
 * With no detectable country we fall back to the EU-wide watch alone
 * rather than guessing at a region.
 */
import { getBriefing, listBriefings, listMyWatches } from '../api/community.js'
import { fetchClientRegion } from '../api/geo.js'

/** The briefing a signed-out reader is seeded with. */
export const DEFAULT_BRIEFING_SLUG = 'public-investment'
/** Per week, from the reader's own country. */
export const DEFAULT_LOCAL_VOLUME = 10
/** Per week, from the EU as a whole. */
export const DEFAULT_EU_VOLUME = 3

/**
 * Merge item lists newest-first, one entry per (briefing, item).
 *
 * Watches overlap on purpose — Coimbra and Portugal both cover Coimbra —
 * so the same record arrives from several of them. Each watch answers
 * its own question, but a single stream must show a thing once. Keyed by
 * briefing AND item, so the same record surfacing in two DIFFERENT
 * briefings still reads as two findings, which it is.
 */
export function mergeBriefingItems(lists) {
  const seen = new Map()
  for (const item of lists.flat()) {
    const key = `${item._from}::${item.item_id}`
    if (!seen.has(key)) seen.set(key, item)
  }
  return [...seen.values()].sort(
    (a, b) => new Date(b.item_time) - new Date(a.item_time),
  )
}

/** The watches to read for a signed-out visitor, given a country code. */
export function anonymousWatches(nuts0) {
  const watches = []
  if (nuts0) {
    watches.push({ nuts: [nuts0], volume_per_week: DEFAULT_LOCAL_VOLUME })
  }
  watches.push({ nuts: [], volume_per_week: DEFAULT_EU_VOLUME })
  return watches
}

async function fetchFor(slug, name, watches) {
  const lists = await Promise.all(watches.map(async (w) => {
    const detail = await getBriefing(slug, {
      nuts: w.nuts, volume: w.volume_per_week,
    })
    return (detail.items || []).map((i) => ({ ...i, _from: name }))
  }))
  return lists
}

/**
 * @param {boolean} authed
 * @returns {Promise<object[]>} newest-first, each tagged with `_from`.
 *   Never throws: a feed that loses its briefings still has its articles,
 *   and an empty briefing stream is a worse outcome than a broken page
 *   only if it is silent — callers surface the error separately.
 */
export async function loadBriefingStream(authed) {
  const briefings = await listBriefings()
  if (!briefings.length) return []

  if (authed) {
    const watches = await listMyWatches()
    if (watches.length) {
      const lists = await Promise.all(watches.map(async (w) => {
        const b = briefings.find((x) => x.id === w.group_id)
        if (!b) return []
        const [items] = await fetchFor(b.slug, b.name, [w])
        return items
      }))
      return mergeBriefingItems(lists)
    }
    // Signed in and watching nothing yet: fall through to the public
    // seed below. Reading it as "wants no briefings" gave a signed-in
    // reader a THINNER landing page than a stranger gets, which is
    // backwards — subscribing to nothing is the state everyone starts
    // in, not a preference.
  }

  const seed = briefings.find((b) => b.slug === DEFAULT_BRIEFING_SLUG)
  if (!seed) return []
  let nuts0 = null
  try {
    ({ nuts0 = null } = await fetchClientRegion() || {})
  } catch {
    // No region is a normal answer, not an error: a datacentre IP, a VPN,
    // or a country the database does not cover. The EU-wide watch below
    // still gives the reader something.
  }
  return mergeBriefingItems(await fetchFor(seed.slug, seed.name, anonymousWatches(nuts0)))
}
