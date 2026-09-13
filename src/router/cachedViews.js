/**
 * Views kept mounted across navigation.
 *
 * Coming back from a detail page should land on the list you left —
 * same items, same scroll — rather than a freshly refetched one at the
 * top. Keeping these alive is what preserves the DOM height that
 * scrollBehavior's saved position needs.
 *
 * Deliberate consequence: a cached feed does not refresh on return. It
 * updates when the reader asks for it, not behind them while they read.
 *
 * These are matched by component name, so each view declares one with
 * defineOptions. A name that drifts turns the KeepAlive include into a
 * filter that matches nothing, and everything still *looks* fine —
 * tests/unit/cachedViews.test.js pins the pairing.
 */
export const CACHED_VIEWS = ['FeedView', 'BriefingsView']
