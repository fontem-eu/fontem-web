/**
 * The 24 EU official languages, in Official Journal order. Codes are
 * ISO-639-1, labels are rendered in each language's own orthography so
 * the picker reads natively to each audience ("Deutsch" not "German").
 *
 * Kept in sync with:
 *  - gmr-linguistics  /languages                              (service truth)
 *  - gmr-consolidator src/consolidator/clients/linguistics.py EU_OFFICIAL_LANGS
 *  - edgar-gmr-etl    src/api/lang.py                          EU_LANGS
 */
export const EU_LANGUAGES = Object.freeze([
  { code: 'bg', label: 'Български' },
  { code: 'cs', label: 'Čeština' },
  { code: 'da', label: 'Dansk' },
  { code: 'de', label: 'Deutsch' },
  { code: 'el', label: 'Ελληνικά' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'et', label: 'Eesti' },
  { code: 'fi', label: 'Suomi' },
  { code: 'fr', label: 'Français' },
  { code: 'ga', label: 'Gaeilge' },
  { code: 'hr', label: 'Hrvatski' },
  { code: 'hu', label: 'Magyar' },
  { code: 'it', label: 'Italiano' },
  { code: 'lt', label: 'Lietuvių' },
  { code: 'lv', label: 'Latviešu' },
  { code: 'mt', label: 'Malti' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'pt', label: 'Português' },
  { code: 'ro', label: 'Română' },
  { code: 'sk', label: 'Slovenčina' },
  { code: 'sl', label: 'Slovenščina' },
  { code: 'sv', label: 'Svenska' },
])

export const EU_CODES = Object.freeze(EU_LANGUAGES.map((l) => l.code))
export const DEFAULT_LANG = 'en'

/** Normalise user input ('EN', 'fr-FR', 'pt_BR', undefined…) to a valid
 *  EU-24 code or null. First two chars, lowercased. */
export function normaliseLang(value) {
  if (!value || typeof value !== 'string') return null
  const code = value.trim().slice(0, 2).toLowerCase()
  return EU_CODES.includes(code) ? code : null
}
