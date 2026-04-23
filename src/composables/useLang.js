import { ref } from 'vue'
import { DEFAULT_LANG, normaliseLang } from './eu-languages.js'

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

function applyLang(code) {
  const next = normaliseLang(code) || DEFAULT_LANG
  lang.value = next
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('gmr-lang', next)
  }
}

/** Global read — the API client wrapper imports this so every request
 *  picks up the current value without prop-drilling the composable. */
export function currentLang() {
  return lang.value
}

export function useLang() {
  function setLang(code) {
    const normalised = normaliseLang(code)
    if (normalised) applyLang(normalised)
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
  function init() {
    if (typeof localStorage !== 'undefined') {
      const saved = normaliseLang(localStorage.getItem('gmr-lang'))
      if (saved) {
        applyLang(saved)
        return
      }
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      const detected = normaliseLang(navigator.language)
      if (detected) {
        applyLang(detected)
        return
      }
    }
    applyLang(DEFAULT_LANG)
  }

  return { lang, setLang, init }
}
