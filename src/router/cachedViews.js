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

/**
 * The key a routed view is rendered under.
 *
 * Only the kept-alive views get one, and theirs is the path: a view that
 * served two paths would otherwise hand each the other's list and scroll
 * position from one shared cache entry. (FeedView served `/` and
 * `/stories-feed` until 2026-09-23; stories-only is a `?show=` filter of
 * `/` now, so it keeps its state by staying on one path.)
 *
 * Every other view gets no key — what it had before KeepAlive existed — so
 * Vue reuses the instance when the path changes but the component does not.
 * That reuse is load-bearing. Keying every view by path re-created it on each
 * navigation inside its own family: StudioPlotView saves a new plot and then
 * replaces /plot with /plot/:id, so the instance that set "Saved" was
 * destroyed before it could show it, and a company profile refetched all of
 * itself on every tab switch.
 */
export function viewKey(component, route) {
  return CACHED_VIEWS.includes(component?.type?.name) ? route.path : undefined
}
