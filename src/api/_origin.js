/**
 * Where API calls go from.
 *
 * In the browser this is empty, so every request stays same-origin and
 * the session cookie rides along — which is the only thing that works
 * for a logged-in user.
 *
 * Under SSR there is no origin to be relative to: Node resolves
 * `/capi/...` against nothing and throws. The SSR server passes the
 * in-cluster address of the community API instead, so a prefetch during
 * render reaches the same data the browser would have fetched a moment
 * later.
 */
export function apiOrigin() {
  if (typeof window !== 'undefined') return ''
  return globalThis.process?.env?.SSR_API_ORIGIN || ''
}
