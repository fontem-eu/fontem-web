/**
 * Where community-API calls go, and under what path.
 *
 * The `/capi` prefix is an nginx routing prefix, not part of the API.
 * nginx strips it before proxying (`rewrite ^/capi/(.*)$ /$1 break`),
 * so the service itself serves `/data-stories/...`, not
 * `/capi/data-stories/...`.
 *
 * That distinction only matters under SSR. In the browser we go
 * same-origin through nginx, so the prefix must be there — and staying
 * same-origin is also what lets the session cookie ride along. Under
 * Node there is no nginx in the path: we talk to the service directly,
 * so the prefix must NOT be there, or every call 404s.
 */
export function capiBase() {
  // globalThis.window rather than bare `window`: this module is imported
  // by Node during SSR, where a bare identifier throws.
  if (globalThis.window !== undefined) return '/capi'
  const origin = globalThis.process?.env?.SSR_API_ORIGIN || ''
  // No origin configured means nothing sensible to talk to; keep the
  // browser shape so the failure is a normal fetch error rather than an
  // invalid-URL throw.
  return origin ? origin.replace(/\/$/, '') : '/capi'
}
