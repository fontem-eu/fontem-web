import { ref } from 'vue'
import { DEFAULT_LANG, normaliseLang } from './eu-languages.js'
import { activateLocale } from '../i18n.js'

/**
 * Language singleton. One of the 24 EU ISO-639-1 codes. Persisted in
 * localStorage under 'gmr-lang'. The server doesn't render text — UI
 * strings come from API responses (Authority names, etc), keyed by
 * `?lang=<code>` on every request. The lang attribute on <html> is
 * kept in sync for screen-reader + SEO correctness.
 *
 * Anti-FOUC: a small synchronous script in index.html sets <html lang>
 * before first paint. `init()` here syncs the reactive ref and migrates
 * any out-of-range saved value to the default.
 *
 * Initial value is an empty string (not 'en') so `currentLang()` returns
 * nothing until `init()` has run. That keeps the pre-mount window + any
 * test environment that doesn't opt in from sending `?lang=en` on URLs
 * the caller didn't ask for. Once `init()` runs (App.vue onMounted), the
 * ref settles on a concrete code.
 */
const lang = ref('')
let i18nInstance = null

function applyLang(code, { persist = false } = {}) {
  const next = normaliseLang(code) || DEFAULT_LANG
  lang.value = next
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next
  }
  // Only an EXPLICIT user pick persists. Detected values (browser,
  // IP-geo) stay ephemeral so tomorrow's detection can differ and a
  // stored value always means "the user chose this".
  if (persist && typeof localStorage !== 'undefined') {
    localStorage.setItem('gmr-lang', next)
  }
  // Kick the locale swap (async; we don't await — applyLang has
  // synchronous callers and a one-tick gap on locale text is
  // imperceptible). The first switch to a non-default locale
  // triggers the lazy-load via i18n.js.
  if (i18nInstance) {
    activateLocale(i18nInstance, next)
  }
}

/** Global read — the API client wrapper imports this so every request
 *  picks up the current value without prop-drilling the composable. */
export function currentLang() {
  return lang.value
}

function setLang(code) {
  const normalised = normaliseLang(code)
  if (normalised) applyLang(normalised, { persist: true })
}

/**
 * Detection order on first load (when nothing is stored):
 *   1. localStorage['gmr-lang']  (user's explicit pick on a prior visit)
 *   2. navigator.language first segment  (browser preference)
 *   3. DEFAULT_LANG ('en')
 *
 * Invalid stored values (a code outside EU-24, or garbage) are normalised
 * or dropped silently.
 */
function init(i18n = null) {
  if (i18n) i18nInstance = i18n
  if (typeof localStorage !== 'undefined') {
    const saved = normaliseLang(localStorage.getItem('gmr-lang'))
    if (saved) {
      applyLang(saved, { persist: true })
      return
    }
  }
  // No stored choice: paint with the browser's language immediately,
  // then let the server's IP-country hint override — a visitor from
  // France gets French even on an en-US browser. Their first explicit
  // pick beats both, permanently.
  if (typeof navigator !== 'undefined' && navigator.language) {
    const detected = normaliseLang(navigator.language)
    if (detected) applyLang(detected)
    else applyLang(DEFAULT_LANG)
  } else {
    applyLang(DEFAULT_LANG)
  }
  detectGeoLang()
}

/**
 * IP-country language hint (GET /api/geo/client-language, resolved
 * server-side against a local database — the IP never leaves the
 * platform). Session-cached so one visit costs one lookup. Fire and
 * forget: failures leave the browser-language fallback in place, and
 * an explicit pick made while the request is in flight wins.
 */
async function detectGeoLang() {
  if (typeof fetch === 'undefined' || typeof sessionStorage === 'undefined') return
  try {
    let hint = normaliseLang(sessionStorage.getItem('gmr-geo-lang'))
    if (!hint) {
      const res = await fetch('/api/geo/client-language')
      if (!res.ok) return
      const data = await res.json()
      hint = normaliseLang(data.lang)
      if (hint) sessionStorage.setItem('gmr-geo-lang', hint)
    }
    // Bail if the user picked explicitly while we were looking up.
    if (typeof localStorage !== 'undefined' && normaliseLang(localStorage.getItem('gmr-lang'))) return
    if (hint && hint !== lang.value) applyLang(hint)
  } catch { /* no hint — the browser-language fallback stands */ }
}

export function useLang() {
  return { lang, setLang, init }
}
