/**
 * Test helper: build a vue-i18n instance loaded with the English
 * dictionary so unit tests can mount components that use `$t`.
 *
 * Tests opt in by passing the returned plugin into
 * `mount(..., { global: { plugins: [...] } })`. We default to English
 * locale only because that's what nearly every existing assertion
 * grew up checking; tests that explicitly need a different locale
 * can pass it via the function arg.
 */
import { createI18n } from 'vue-i18n'

import en from '../../../src/locales/en.json'

export function makeTestI18n(locale = 'en') {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    messages: { en },
    missingWarn: false,
    fallbackWarn: false,
  })
}
