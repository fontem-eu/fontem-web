/**
 * Where the page should be scrolled to after a navigation.
 *
 * Lives beside authGate.js for the same reason: router behaviour worth
 * testing should not be trapped inside the createRouter() call.
 *
 * `savedPosition` is supplied by vue-router only on a genuine pop — the
 * browser's back or forward — and holds where that entry was left. A
 * push is a new page and starts at the top, as it would anywhere else.
 *
 * Declaring any scrollBehavior also flips the browser's own
 * `history.scrollRestoration` to "manual", which stops it restoring a
 * position of its own underneath us.
 *
 * Restoring a position only works on a view that still has its height
 * when this runs. A view destroyed on navigate and refetched on return
 * is a few hundred pixels of skeleton at that moment, and the restore
 * silently clamps to the top — which is why the feeds are kept alive
 * (see cachedViews.js).
 */
export function scrollBehavior(to, from, savedPosition) {
  if (savedPosition) return savedPosition
  if (to && to.hash) return { el: to.hash }
  return { top: 0 }
}
