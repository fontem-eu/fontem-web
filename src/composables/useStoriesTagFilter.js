/**
 * Stories list tag-filter persistence.
 *
 * The Feed view lets users filter the public-story list by tag via a
 * chip strip. The selected tag is reflected in the URL (`?tag=X`) so
 * the filter stays shareable and bookmarkable — but clicking a story
 * card navigates to `/stories/:id`, and a link back (the story page's
 * "Back to stories", or the global nav) arrives with no query at all.
 * The browser's back button preserves the URL; a link does not. FeedView
 * is kept alive rather than unmounted, but the query is still gone.
 *
 * Persist the most recent tag locally so the next time the user lands
 * on `/` *without* a `?tag=` already in the URL, the saved tag is
 * restored. Writing to a single key + reading via a guarded
 * `getStoredTag()` keeps the composable a thin facade over
 * localStorage — same shape as useFollowedTags / usePocket.
 */
const STORAGE_KEY = 'gmr-stories-tag'

function _safeGet() {
  if (typeof localStorage === 'undefined') return null
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v?.length ? v : null
  } catch { return null }
}

function _safeSet(value) {
  if (typeof localStorage === 'undefined') return
  try {
    if (value == null || value === '') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, String(value))
  } catch { /* private mode / quota — non-fatal */ }
}

export function useStoriesTagFilter() {
  return {
    /** Last-saved tag, or null if none / SSR / disabled storage. */
    getStoredTag: _safeGet,
    /** Persist `tag` (string) or null to clear. */
    saveTag: _safeSet,
    /** Drop the persisted tag. */
    clearStoredTag: () => _safeSet(null),
    /** Exposed for tests that want to assert on the actual key. */
    _STORAGE_KEY: STORAGE_KEY,
  }
}
