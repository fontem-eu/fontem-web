/**
 * Route auth-gate predicate.
 *
 * Why a predicate, not a prefix list: `/stories/:id` is the public
 * read view (anyone can open a `public_open` story by URL), while
 * `/stories/:id/edit` is the editor. A naive `startsWith('/stories')`
 * match swallows both, which broke anonymous public-story viewing
 * (regression introduced when SSR scaffolding was added; the backend
 * was already correctly serving public stories anonymously). Keep
 * each path family explicit so the next person adding a route makes
 * the choice deliberately.
 *
 * Legacy `/reports*` and `/my-reports` paths still match because the
 * router redirects them to `/stories*`/`/my-stories`; without a
 * matching auth-gate predicate, the user would hit /login first and
 * land there instead of the redirect target.
 *
 * Lives in its own file (rather than inlined in app.js) so unit
 * tests can import it without dragging the full router + Vue
 * component graph along for the ride.
 */
export function requiresAuth(path) {
  if (path === '/my-stories' || path.startsWith('/my-stories/')) return true
  if (path === '/my-reports' || path.startsWith('/my-reports/')) return true
  // /stories/:id (and legacy /reports/:id) are public read views;
  // /stories/:id/edit (and /reports/:id/edit) are the editor. Match
  // the editor explicitly so the read view stays open.
  if (/^\/stories\/[^/]+\/edit/.test(path)) return true
  if (/^\/reports\/[^/]+\/edit/.test(path)) return true
  if (path === '/issues' || path.startsWith('/issues/')) return true
  if (path === '/studio' || path.startsWith('/studio/')) return true
  if (path === '/activity') return true
  // /briefings is the public catalogue; /my-briefings is a personal reading
  // list, so only the second needs a session.
  if (path === '/my-briefings') return true
  if (path === '/ai-usage') return true
  if (path === '/admin' || path.startsWith('/admin/')) return true
  return false
}
