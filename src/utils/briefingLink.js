/**
 * Where a briefing item card should take the reader.
 *
 * The backend already answers this: every feed item carries a `link`
 * produced by the named query that found it (the `link` column in
 * feed_contract.py's REQUIRED_COLUMNS). The query knows what kind of
 * thing it matched, so the mapping belongs there rather than in a
 * client-side switch on item shape that would go stale the moment
 * somebody writes a new briefing.
 *
 * Two things still have to happen here.
 *
 * 1. Those links are ABSOLUTE and hard-code the production origin
 *    ('https://fontem.eu/contract/...'), because the query text bakes
 *    it in. Rendered as-is a card on staging sends the reader to
 *    production, and even on prod it is a full page load instead of a
 *    router navigation. So a same-site link is reduced to a path and
 *    handed to vue-router.
 *
 * 2. Not every item has a destination. The EU lobbying query emits
 *    "'https://fontem.eu/company/' + coalesce(l.company_gmr_id, '')",
 *    so a Lobbyist with no resolved company yields a bare '/company/'
 *    that matches no route. Roughly four in five lobbyists are
 *    unresolved today, so that is the common case rather than an edge
 *    one. Better to render those as plain text than to hand the reader
 *    a dead click.
 */

/**
 * Hosts that are us, whichever environment served the item.
 *
 * dargle.eu is the canonical host. fontem.eu is here because it is
 * still what the rows say: the links are built inside stored named
 * queries living in the database, which the rename did not touch, so
 * every briefing item served today carries the old origin. Dropping it
 * from this set would not break the cards -- it would quietly turn
 * every one of them into an external link off to the old domain.
 *
 * Both stay listed even after the queries are rewritten: rows already
 * captured keep the origin they were captured with.
 */
const SITE_HOSTS = new Set([
  'dargle.eu', 'www.dargle.eu',
  'fontem.eu', 'www.fontem.eu',
])

/**
 * A path is only a destination if something can be at the other end.
 * '/company/' and '/contract/' (no id) come from a coalesce-to-empty
 * in the query and match no route.
 */
function isDeadEnd(pathname) {
  if (!pathname || pathname === '/') return true
  return pathname.split('/').filter(Boolean).length < 2
}

/**
 * @param {{link?: string}} item a briefing/feed item
 * @returns {{kind: 'internal'|'external'|'none', to: string|null}}
 *   'internal' -> a router path, 'external' -> an absolute href to open
 *   in a new tab, 'none' -> render the title as plain text.
 */
export function briefingLink(item) {
  const raw = typeof item?.link === 'string' ? item.link.trim() : ''
  if (!raw) return { kind: 'none', to: null }

  // Already a path: trust it, but still reject the dead ends.
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return isDeadEnd(raw.split('?')[0].split('#')[0])
      ? { kind: 'none', to: null }
      : { kind: 'internal', to: raw }
  }

  let url
  try {
    url = new URL(raw)
  } catch {
    // Not a URL and not a path -- nothing safe to do with it.
    return { kind: 'none', to: null }
  }

  // Anything that is not http(s) (javascript:, data:, ...) is not a
  // destination we will hand a reader, however it got into the row.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { kind: 'none', to: null }
  }

  if (SITE_HOSTS.has(url.hostname)) {
    const path = url.pathname + url.search + url.hash
    return isDeadEnd(url.pathname) ? { kind: 'none', to: null } : { kind: 'internal', to: path }
  }

  return { kind: 'external', to: url.href }
}
