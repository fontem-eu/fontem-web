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
 * The feed's VIEW is remembered for the same reason: since Stories and
 * the briefings reader became filters of the one feed (?show=stories,
 * ?show=briefings, ?briefing=<slug>) rather than pages of their own, a
 * reader who opened a story from "Stories only" and followed its back
 * link would otherwise come back to everything. Stored as 'stories' |
 * 'briefings' | 'briefing:<slug>'; the mixed view is the absence of a
 * value.
 *
 * But only for this visit, and only for the reader who chose it. It used
 * to sit in localStorage with no end, so one look at a single briefing
 * narrowed every later visit to it: a reader following Public investment
 * in Portugal and Corporate influence in the EU signed in on 2026-09-29
 * to a feed of Portuguese cards alone, with nothing but the picker to say
 * why. A round trip through a card happens inside one tab session, which
 * sessionStorage covers; signing in or out reloads that same tab, which
 * is why the reader is part of what is stored.
 */
const STORAGE_KEY = 'gmr-stories-tag'
const VIEW_KEY = 'gmr-feed-view'

const local = () => (typeof localStorage === 'undefined' ? null : localStorage)
const session = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage)

function _read(store, key) {
  try {
    const v = store()?.getItem(key)
    return v?.length ? v : null
  } catch { return null }
}

function _write(store, key, value) {
  try {
    if (value == null || value === '') store()?.removeItem(key)
    else store()?.setItem(key, String(value))
  } catch { /* private mode / quota — non-fatal */ }
}

const _safeGet = () => _read(local, STORAGE_KEY)
const _safeSet = (value) => _write(local, STORAGE_KEY, value)

/** The view `reader` saved on this visit, or null. '' is the signed-out reader. */
function _getView(reader = '') {
  try {
    const saved = JSON.parse(_read(session, VIEW_KEY))
    return saved?.reader === reader && saved.view ? String(saved.view) : null
  } catch { return null }
}

function _saveView(view, reader = '') {
  _write(session, VIEW_KEY, view ? JSON.stringify({ reader, view }) : null)
}

export function useStoriesTagFilter() {
  return {
    /** Last-saved tag, or null if none / SSR / disabled storage. */
    getStoredTag: _safeGet,
    /** Persist `tag` (string) or null to clear. */
    saveTag: _safeSet,
    /** Drop the persisted tag. */
    clearStoredTag: () => _safeSet(null),
    /** The feed view `reader` chose on this visit, or null for the mixed feed. */
    getStoredView: _getView,
    /** Remember the feed view for this visit, or null / '' for the mixed feed. */
    saveView: _saveView,
    /** Exposed for tests that want to assert on the actual key. */
    _STORAGE_KEY: STORAGE_KEY,
    _VIEW_KEY: VIEW_KEY,
  }
}
