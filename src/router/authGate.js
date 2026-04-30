/**
 * Route auth-gate predicate.
 *
 * Why a predicate, not a prefix list: `/reports/:id` is the public
 * read view (anyone can open a `public_open` report by URL), while
 * `/reports/:id/edit` is the editor. A naive `startsWith('/reports')`
 * match swallows both, which broke anonymous public-report viewing
 * (regression introduced when SSR scaffolding was added; the backend
 * was already correctly serving public reports anonymously). Keep
 * each path family explicit so the next person adding a route makes
 * the choice deliberately.
 *
 * Lives in its own file (rather than inlined in app.js) so unit
 * tests can import it without dragging the full router + Vue
 * component graph along for the ride.
 */
export function requiresAuth(path) {
  if (path === '/my-reports' || path.startsWith('/my-reports/')) return true
  // /reports/:id is the public read view; /reports/:id/edit is the
  // editor. Match the editor explicitly so the read view stays open.
  if (/^\/reports\/[^/]+\/edit/.test(path)) return true
  if (path === '/issues' || path.startsWith('/issues/')) return true
  if (path === '/activity') return true
  if (path === '/ai-usage') return true
  if (path === '/admin' || path.startsWith('/admin/')) return true
  return false
}
