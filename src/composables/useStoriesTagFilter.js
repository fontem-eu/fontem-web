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
 *
 * The feed's VIEW is remembered the same way, for the same reason: since
 * Stories and the briefings reader became filters of the one feed
 * (?show=stories, ?show=briefings, ?briefing=<slug>) rather than pages
 * of their own, a reader who opened a story from "Stories only" and
 * followed its back link would otherwise come back to everything. Stored
 * as 'stories' | 'briefings' | 'briefing:<slug>'; the mixed view is the
 * absence of a value.
 */
const STORAGE_KEY = 'gmr-stories-tag'
const VIEW_KEY = 'gmr-feed-view'

function _read(key) {
  if (typeof localStorage === 'undefined') return null
  try {
    const v = localStorage.getItem(key)
    return v?.length ? v : null
  } catch { return null }
}

function _write(key, value) {
  if (typeof localStorage === 'undefined') return
  try {
    if (value == null || value === '') localStorage.removeItem(key)
    else localStorage.setItem(key, String(value))
  } catch { /* private mode / quota — non-fatal */ }
}

const _safeGet = () => _read(STORAGE_KEY)
const _safeSet = (value) => _write(STORAGE_KEY, value)

export function useStoriesTagFilter() {
  return {
    /** Last-saved tag, or null if none / SSR / disabled storage. */
    getStoredTag: _safeGet,
    /** Persist `tag` (string) or null to clear. */
    saveTag: _safeSet,
    /** Drop the persisted tag. */
    clearStoredTag: () => _safeSet(null),
    /** Last-saved feed view, or null for the mixed feed. */
    getStoredView: () => _read(VIEW_KEY),
    /** Persist the feed view, or null / '' for the mixed feed. */
    saveView: (value) => _write(VIEW_KEY, value),
    /** Exposed for tests that want to assert on the actual key. */
    _STORAGE_KEY: STORAGE_KEY,
    _VIEW_KEY: VIEW_KEY,
  }
}
