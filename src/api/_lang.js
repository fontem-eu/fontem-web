import { currentLang } from '../composables/useLang.js'

/**
 * Append `lang=<current>` to a path/URL query string. Safe to call on
 * any URL: skips when the lang is already present so a caller that
 * happens to pass an explicit override wins.
 *
 * Every outbound API call in this app routes through here so every
 * backend handler receives the user's current language without each
 * caller needing to remember.
 *
 * SSR-safe: on the server `currentLang()` returns the default ('en'),
 * which the Neo4j layer treats as a no-op (coalesce falls through to
 * the stored `name`).
 */
export function withLang(path) {
  const lang = currentLang()
  if (!lang) return path
  // Already present → caller is being explicit.
  const qIndex = path.indexOf('?')
  if (qIndex !== -1 && /(^|[?&])lang=/.test(path.slice(qIndex))) return path
  const sep = qIndex === -1 ? '?' : '&'
  return `${path}${sep}lang=${encodeURIComponent(lang)}`
}
