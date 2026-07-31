/**
 * Which text should a story open in? The reader's UI language wins when
 * a CURRENT translation for it exists; the original wins when the UI
 * language IS the original's language, when no matching translation
 * exists, when the UI language is unknown, or when the only matching
 * translation is outdated. Returns '' for the original, or the
 * translation's lang code.
 *
 * Outdated translations are never opened automatically: the original was
 * edited after the translation was written, so its text is known to be
 * wrong. A reader who never touched the language picker would otherwise
 * be silently served stale facts in their own language — the worst
 * failure mode for a platform whose point is checking claims against
 * current numbers.
 */
export function defaultTranslationFor(uiLang, originalLang, translations) {
  if (!uiLang || uiLang === originalLang) return ''
  const match = (translations || []).find((t) => t.lang === uiLang)
  if (!match || match.outdated) return ''
  return match.lang
}
