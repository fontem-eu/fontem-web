/**
 * How the mixed feed is ordered.
 *
 * The feed used to be two stacked sections: every briefing finding, then
 * every data story. That reads as two lists on one page — a reader
 * scrolling the findings never reaches the stories, and the stories look
 * like an appendix rather than part of the same stream.
 *
 * So the stories are folded INTO the run of briefings: one story after
 * every `every` briefings. Often enough that a reader meets one without
 * looking for it, rarely enough that the feed still reads as a stream of
 * findings rather than as an alternating pattern.
 *
 * Order within each kind is preserved — both arrive newest-first and
 * stay that way. This only decides where the seams are.
 */

/** Briefings between one inserted story and the next. */
export const STORY_EVERY = 5

/**
 * @param {object[]} briefings newest-first
 * @param {object[]} stories   newest-first, possibly only the pages loaded so far
 * @param {number} every
 * @param {object} [opts]
 * @param {boolean} [opts.storiesComplete=true] false while more stories
 *   can still be fetched. The list then STOPS at the first story slot that
 *   has no story loaded yet, instead of carrying on with briefings.
 *
 *   Why: stories arrive a page at a time, briefings all at once. Without
 *   the stop, a feed with 20 stories loaded would run on through every
 *   remaining briefing — and the next page of stories would then be
 *   spliced in BETWEEN briefings the reader has already scrolled past,
 *   shifting what is on their screen. With it, everything already
 *   emitted is final: loading more stories only ever extends the end.
 * @returns {{kind: 'briefing'|'story', item: object}[]}
 */
export function interleaveFeed(briefings, stories, every = STORY_EVERY, { storiesComplete = true } = {}) {
  const b = Array.isArray(briefings) ? briefings : []
  const s = Array.isArray(stories) ? stories : []
  if (every < 1) throw new Error('every must be >= 1')

  const out = []
  let si = 0
  for (let bi = 0; bi < b.length; bi += 1) {
    out.push({ kind: 'briefing', item: b[bi] })
    if ((bi + 1) % every !== 0) continue
    if (si < s.length) {
      out.push({ kind: 'story', item: s[si] })
      si += 1
    } else if (!storiesComplete) {
      // A story belongs here and has not been fetched yet. Wait for it
      // rather than emit briefings it would later have to push aside.
      return out
    }
  }
  // Whichever side outlasts the other finishes the list. Stories left
  // over must not be dropped: with few briefings they would otherwise
  // never appear at all, which is how a feed silently loses a whole
  // content type.
  for (; si < s.length; si += 1) out.push({ kind: 'story', item: s[si] })
  return out
}

/** Stable key for a feed entry, for `v-for`. */
export function feedKey(entry) {
  return entry.kind === 'story'
    ? `story::${entry.item.id}`
    : `briefing::${entry.item._from}::${entry.item.item_id}`
}
