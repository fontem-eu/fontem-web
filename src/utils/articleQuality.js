/**
 * Article-quality heuristics — cheap, explainable scores that nudge stories
 * toward the house style: a ~10-minute read that is genuinely data-based
 * (its reading time split roughly between prose and data structures).
 *
 * Both scores are pure functions in the range (0, 1], peaking at 1 when the
 * article hits the target and falling off with the SQUARE of the distance —
 * so they degrade gently near the target and sharply far from it. They read
 * from the document model (via readingTime.tallyTiptap), never the DOM, so
 * they never go stale on edit and cost nothing to compute.
 *
 * Only text and data structures (widgets + tables — see readingTime.js) feed
 * the estimate. Images and other passive media are deliberately ignored.
 */
import {
  tallyTiptap,
  minutesFromTally,
  WORDS_PER_MINUTE,
  SECONDS_PER_PLOT,
  COMPLEXITY_TAX,
} from './readingTime.js'

/** The ideal read length, in minutes. */
export const TARGET_MINUTES = 10

/**
 * Target for text-time / data-time. 0.5 means data structures carry twice the
 * reading time of prose — a data-first article with prose as the aid, not the
 * substance. (Flip to 1.0 for a strict "half and half" if the editorial line
 * changes; the formula and UI follow this constant.)
 */
export const TARGET_TEXT_DATA_RATIO = 0.5

/** How far from target still counts as "on target" for suggestion purposes. */
export const MINUTES_TOLERANCE = 3
export const RATIO_TOLERANCE = 0.2

/**
 * Reading-time score: 10 / (10 + (minutes - 10)^2), generalised over the
 * target. 1.0 at exactly the target, symmetric, monotone-decreasing away from
 * it. Range (0, 1].
 */
export function readingTimeScore(minutes, target = TARGET_MINUTES) {
  const d = Math.abs((Number(minutes) || 0) - target)
  return target / (target + d * d)
}

/**
 * Split a { words, plots } tally into its prose- vs data-reading-time
 * contributions, in minutes. The complexity tax is applied to both (it cancels
 * in the ratio, but we keep the split in honest minutes for display).
 */
export function splitMinutes({ words = 0, plots = 0 } = {}, opts = {}) {
  const {
    wpm = WORDS_PER_MINUTE,
    secondsPerPlot = SECONDS_PER_PLOT,
    complexityTax = COMPLEXITY_TAX,
  } = opts
  const factor = 1 + complexityTax
  const textMinutes = (words / wpm) * factor
  const dataMinutes = ((plots * secondsPerPlot) / 60) * factor
  return { textMinutes, dataMinutes }
}

/**
 * Data-to-text balance score: 10 / (10 + (|0.5 - text/data| * 10)^2).
 * 1.0 when text-time is exactly half the data-time (the target ratio),
 * symmetric in the ratio, monotone-decreasing away from it.
 *
 * A story with no data structures at all scores 0 — a data-based article must
 * carry data. A truly empty article (no text and no data) scores 0 too: there
 * is nothing to be balanced.
 */
export function balanceScore(textMinutes, dataMinutes, target = TARGET_TEXT_DATA_RATIO) {
  const t = Number(textMinutes) || 0
  const d = Number(dataMinutes) || 0
  if (d <= 0) return 0
  const ratio = t / d
  const dist = Math.abs(target - ratio) * 10
  return 10 / (10 + dist * dist)
}

/**
 * Suggestions keyed for i18n. Driven by the honest minutes and the text/data
 * ratio, so the advice matches which bar is off and in which direction.
 */
export function suggestionsFor({ totalMinutes, textMinutes, dataMinutes }) {
  const out = []
  // Length.
  if (totalMinutes > TARGET_MINUTES + MINUTES_TOLERANCE) {
    out.push('too_long_split', 'too_long_summarize')
  } else if (totalMinutes < TARGET_MINUTES - MINUTES_TOLERANCE) {
    out.push('too_short_explain', 'too_short_add_data')
  }
  // Balance (target ratio = text is half the data).
  if (dataMinutes <= 0) {
    if (!out.includes('too_short_add_data')) out.push('no_data_add_plots')
  } else {
    const ratio = textMinutes / dataMinutes
    if (ratio > TARGET_TEXT_DATA_RATIO + RATIO_TOLERANCE) {
      out.push('too_much_text_add_plots')
    } else if (ratio < TARGET_TEXT_DATA_RATIO - RATIO_TOLERANCE) {
      out.push('too_much_data_explain')
    }
  }
  return out
}

/**
 * Evaluate a v2 Tiptap document. Returns the tally, the honest total minutes,
 * the prose/data split, both scores, the ratio, and i18n suggestion keys.
 */
export function evaluateQuality(doc, opts = {}) {
  const tally = tallyTiptap(doc)
  const totalMinutes = minutesFromTally(tally, opts)
  const { textMinutes, dataMinutes } = splitMinutes(tally, opts)
  const ratio = dataMinutes > 0 ? textMinutes / dataMinutes : Infinity
  return {
    tally,
    totalMinutes,
    textMinutes,
    dataMinutes,
    ratio,
    readingTimeScore: readingTimeScore(totalMinutes),
    balanceScore: balanceScore(textMinutes, dataMinutes),
    suggestions: suggestionsFor({ totalMinutes, textMinutes, dataMinutes }),
  }
}
