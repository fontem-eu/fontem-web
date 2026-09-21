/**
 * Case- and diacritic-insensitive text folding, for matching names.
 *
 * `Ática` → `atica`, `Αττική` → `αττικη`, `Bergstraße` → `bergstrasse`.
 * Mirrors `fold()` in the API's nuts_gazetteer module and in the gazetteer
 * builder — the server ships a pre-folded search index, so the two have to
 * agree character for character or a query that matches the index won't
 * match the name shown next to it.
 *
 * NFD then dropping combining marks, rather than a hand-written accent map:
 * it covers every script the region names use (Latin, Greek, Cyrillic)
 * without a table that quietly misses one.
 *
 * The two explicit substitutions are where JS `toLowerCase()` and Python
 * `casefold()` disagree, and both turn up in real region names:
 * `Αττικής` lowercases to a final sigma here and to a medial one there,
 * and `Bergstraße` keeps its ß here while casefold expands it to `ss`.
 * Without them, "Bergstrasse" and "Αττικής" would miss.
 */
export function foldText(text) {
  if (!text) return ''
  return String(text)
    .toLowerCase()
    .replace(/ς/g, 'σ')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
}
