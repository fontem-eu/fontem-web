/**
 * useAnalytics — thin wrapper around Umami's browser SDK.
 *
 * Umami is loaded lazily from `window.UMAMI_SRC` (set by the
 * /umami-config.js ConfigMap).  All calls are no-ops when:
 *   - running in local dev (UMAMI_WEBSITE_ID not set)
 *   - the Umami script hasn't finished loading yet
 *   - the user has JS disabled for the analytics domain
 *
 * Usage:
 *   const { track } = useAnalytics()
 *   track('ticker-selected', { symbol: 'AAPL' })
 */

let _loaded = false

function _bootstrap() {
  if (_loaded) return
  const src = window.UMAMI_SRC
  const id  = window.UMAMI_WEBSITE_ID
  if (!src || !id) return
  _loaded = true
  const s = document.createElement('script')
  s.defer = true
  s.src   = src
  s.setAttribute('data-website-id', id)
  s.setAttribute('data-auto-track', 'true')
  document.head.appendChild(s)
}

export function useAnalytics() {
  _bootstrap()

  function track(eventName, props) {
    // window.umami is injected by the Umami script after it loads
    if (typeof window !== 'undefined' && window.umami?.track) {
      window.umami.track(eventName, props)
    }
  }

  return { track }
}
