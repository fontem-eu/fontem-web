/**
 * Keyset paging against the community API's list endpoints — the contract is
 * fontem-community-api src/api/paging.py. A page is a plain array, newest
 * first. The cursor for the next page is the last row's `updated_at|id`.
 *
 * "More" is known only by a FULL page: exactly `limit` rows means there may be
 * another. Not "at least `limit`" — an API that predates paging ignores the
 * limit and returns everything in one go, and that must read as "no more",
 * not as a page with a Show-more button that fetches the same rows forever.
 */
export const PAGE_SIZE = Object.freeze({ projects: 30, investigations: 10 })

/** The largest page each endpoint allows; what the pickers walk at. */
export const MAX_PAGE_SIZE = Object.freeze({ projects: 200, investigations: 500 })

export const cursorOf = (row) => (row && row.updated_at && row.id ? `${row.updated_at}|${row.id}` : '')

export const mayHaveMore = (page, limit) => Array.isArray(page) && page.length === limit

/** `?limit=…&before=…`, plus any extra filters, URL-encoded. */
export function pageQuery({ limit, before } = {}, extra = {}) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(extra)) if (v != null && v !== '') q.set(k, String(v))
  if (limit) q.set('limit', String(limit))
  if (before) q.set('before', before)
  const s = q.toString()
  return s ? `?${s}` : ''
}

/**
 * Append a page to what is already shown, skipping rows already there. A row
 * updated between two fetches moves to the top of the server's order; this
 * keeps it from appearing twice if it happens to be fetched again.
 */
export function appendPage(have, page) {
  const ids = new Set(have.map((r) => r.id))
  return [...have, ...(Array.isArray(page) ? page : []).filter((r) => !ids.has(r.id))]
}

/**
 * Every row, a page at a time. For the pickers that choose from ALL of a
 * user's investigations — there is no unbounded list any more, so they walk
 * it at the largest page the server allows. Stops on a short page, and on a
 * page with nothing new, so a server that ignored `before` cannot loop it.
 */
export async function fetchAll(fetchPage, limit) {
  let all = []
  let before = ''
  for (;;) {
    const page = await fetchPage({ limit, before })
    const next = appendPage(all, page)
    const grew = next.length > all.length
    all = next
    if (!mayHaveMore(page, limit) || !grew) return all
    before = cursorOf(page[page.length - 1])
  }
}
