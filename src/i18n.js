/**
 * vue-i18n factory + lazy locale loader.
 *
 * Bootstraps with the English message catalogue eagerly (kept in the
 * initial bundle so first paint never blocks on a fetch). Every other
 * locale is fetched on demand via a dynamic import — switching from
 * `en` to e.g. `fr` downloads `locales/fr.json` once, then keeps it
 * in memory until the page reloads.
 *
 * Wiring with ``useLang`` happens in app.js: when the lang ref flips,
 * we ensure the locale is loaded, then set ``i18n.global.locale``.
 *
 * Why a factory and not a module-scope singleton: SSR. ``entry-server``
 * imports this same file, and giving each render its own i18n instance
 * keeps a request from leaking its locale into the next.
 */
import { createI18n } from 'vue-i18n'

import en from './locales/en.json'

const loaded = { en: true }
const messageImporters = {
  bg: () => import('./locales/bg.json'),
  cs: () => import('./locales/cs.json'),
  da: () => import('./locales/da.json'),
  de: () => import('./locales/de.json'),
  el: () => import('./locales/el.json'),
  es: () => import('./locales/es.json'),
  et: () => import('./locales/et.json'),
  fi: () => import('./locales/fi.json'),
  fr: () => import('./locales/fr.json'),
  ga: () => import('./locales/ga.json'),
  hr: () => import('./locales/hr.json'),
  hu: () => import('./locales/hu.json'),
  it: () => import('./locales/it.json'),
  lt: () => import('./locales/lt.json'),
  lv: () => import('./locales/lv.json'),
  mt: () => import('./locales/mt.json'),
  nl: () => import('./locales/nl.json'),
  pl: () => import('./locales/pl.json'),
  pt: () => import('./locales/pt.json'),
  ro: () => import('./locales/ro.json'),
  sk: () => import('./locales/sk.json'),
  sl: () => import('./locales/sl.json'),
  sv: () => import('./locales/sv.json'),
}

export function createDargleI18n() {
  return createI18n({
    legacy: false,           // use Composition API; matches the codebase
    locale: 'en',
    fallbackLocale: 'en',
    messages: { en },
    missingWarn: import.meta.env?.DEV,
    fallbackWarn: false,
  })
}

/**
 * Ensure the messages for ``code`` are loaded into ``i18n``. Returns a
 * promise that resolves to the now-active code. Re-resolves
 * synchronously on subsequent calls for an already-loaded locale, so
 * callers can await it on every lang switch without paying a network
 * roundtrip after the first.
 */
export async function ensureLocale(i18n, code) {
  if (loaded[code]) return code
  const loader = messageImporters[code]
  if (!loader) return 'en'
  const mod = await loader()
  i18n.global.setLocaleMessage(code, mod.default || mod)
  loaded[code] = true
  return code
}

/** Switch the active locale, loading lazily if needed. */
export async function activateLocale(i18n, code) {
  const resolved = await ensureLocale(i18n, code)
  i18n.global.locale.value = resolved
}
