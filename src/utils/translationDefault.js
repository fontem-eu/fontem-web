/**
 * Which text should a story open in? The reader's UI language wins when
 * a translation for it exists; the original wins when the UI language IS
 * the original's language, when no matching translation exists, or when
 * the UI language is unknown. Returns '' for the original, or the
 * translation's lang code.
 */
export function defaultTranslationFor(uiLang, originalLang, translations) {
  if (!uiLang || uiLang === originalLang) return ''
  const match = (translations || []).find((t) => t.lang === uiLang)
  return match ? match.lang : ''
}
