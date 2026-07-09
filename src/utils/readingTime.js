/**
 * Estimated reading time for a story — a pure function of its content, so it
 * needs no persistence, no server round-trip, and never goes stale on edit.
 * We tally from the document *model* (Tiptap JSON / legacy sections), not the
 * rendered DOM, so it stays correct when the reader switches translation
 * (different languages have different word counts) without measuring layout.
 *
 * Constants:
 *  - WORDS_PER_MINUTE 238 — adult silent reading of non-fiction prose
 *    (Brysbaert 2019, meta-analysis of 190 studies / 17,887 readers; the
 *    observed range is 175–300 wpm). More honest than the 265 wpm Medium
 *    uses, which skews fast.
 *  - SECONDS_PER_PLOT 30 — interpreting one interactive data widget. Medium
 *    adds ~12s for a *passive* image on a declining scale; our plots are
 *    analytical, invite hover/tap, and each is a distinct finding, so we use
 *    a flat ~30s (no decline). Decorative images and tables are NOT counted —
 *    only first-class widget/plot nodes.
 */
export const WORDS_PER_MINUTE = 238
export const SECONDS_PER_PLOT = 30

function countWords(text) {
  if (!text) return 0
  const m = String(text).trim().match(/\S+/g)
  return m ? m.length : 0
}

// Recursively walk a Tiptap/ProseMirror node: sum words in text nodes, count
// `widget` nodes (the plots).
function scanNode(node, acc) {
  if (!node || typeof node !== 'object') return acc
  if (node.type === 'text') acc.words += countWords(node.text)
  else if (node.type === 'widget') acc.plots += 1
  if (Array.isArray(node.content)) {
    for (const child of node.content) scanNode(child, acc)
  }
  return acc
}

/** Tally { words, plots } from a v2 Tiptap document (the `tiptap` doc node). */
export function tallyTiptap(doc) {
  return scanNode(doc, { words: 0, plots: 0 })
}

/**
 * Tally { words, plots } from legacy v1 section content (markdown/HTML with
 * ```widget fenced blocks). Strips tags/entities for the word count and counts
 * widget fences as plots.
 */
export function tallyLegacySections(sections = []) {
  const widgetRe = /```widget[\s\S]*?```|<pre><code class="language-widget">[\s\S]*?<\/code><\/pre>/g
  const acc = { words: 0, plots: 0 }
  for (const sec of sections) {
    const content = sec && sec.content ? String(sec.content) : ''
    const widgets = content.match(widgetRe)
    acc.plots += widgets ? widgets.length : 0
    const prose = content
      .replace(widgetRe, ' ')
      .replace(/<[^>]*>/g, ' ')        // html tags
      .replace(/&[a-z#0-9]+;/gi, ' ')  // html entities
      .replace(/[#>*_`~|-]+/g, ' ')    // markdown punctuation
    acc.words += countWords(prose)
  }
  return acc
}

/** Minutes from a { words, plots } tally. Always at least 1. */
export function minutesFromTally(
  { words = 0, plots = 0 } = {},
  { wpm = WORDS_PER_MINUTE, secondsPerPlot = SECONDS_PER_PLOT } = {},
) {
  const seconds = (words / wpm) * 60 + plots * secondsPerPlot
  return Math.max(1, Math.round(seconds / 60))
}
