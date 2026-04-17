/**
 * useAnalytics — sends tracking events directly to the Umami v3 API.
 *
 * Events are POSTed to /umami/api/send (proxied by nginx to the
 * in-cluster Umami service). No external script is loaded.
 *
 * All calls are silent no-ops when UMAMI_WEBSITE_ID is not set
 * (local dev, before first Umami setup, or if the fetch fails).
 *
 * Usage:
 *   const { track, page } = useAnalytics()
 *   page()                                      // manual page view
 *   track('ticker-selected', { symbol: 'AAPL' }) // custom event
 */

const ENDPOINT = '/umami/api/send'

function _websiteId() {
  return typeof window !== 'undefined' ? window.UMAMI_WEBSITE_ID : null
}

function _basePayload() {
  return {
    website:  _websiteId(),
    url:      typeof window !== 'undefined' ? window.location.pathname : '/',
    hostname: typeof window !== 'undefined' ? window.location.hostname : '',
    language: typeof navigator !== 'undefined' ? navigator.language : '',
    screen:   typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '',
  }
}

function _hasConsent() {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem('gmr-cookie-consent') === 'accepted'
}

function _send(payload) {
  const id = _websiteId()
  if (!id || id === 'REPLACE_WITH_WEBSITE_ID') return
  if (!_hasConsent()) return
  // fire-and-forget; ignore errors so analytics never breaks the UI
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'event', payload }),
    keepalive: true,
  }).catch(() => {})
}

export function useAnalytics() {
  /** Track a page view for the current URL. */
  function page(url) {
    _send({ ..._basePayload(), url: url ?? _basePayload().url })
  }

  /** Track a named custom event with optional properties. */
  function track(name, data) {
    _send({ ..._basePayload(), name, data })
  }

  return { track, page }
}
