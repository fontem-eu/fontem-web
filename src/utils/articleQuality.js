/**
 * Article-quality heuristics — cheap, explainable scores that nudge stories
 * toward the house style: a ~10-minute read that is genuinely data-based
 * (its reading time split roughly evenly between prose and data structures).
 *
 * Both scores are pure functions in the range (0, 1], peaking at 1 when the
 * article hits the target and falling off with the SQUARE of the distance.
 * They read from the document model (via readingTime.tallyTiptap), never the
 * DOM, so they never go stale on edit. Only text and data structures
 * (widgets + tables — see readingTime.js) feed the estimate; images and other
 * passive media are ignored.
 *
 * These heuristics are meant to be tuned by feel. Every knob is read at
 * evaluation time from a runtime config (window.__QUALITY_CONFIG__), injected
 * by the deployment from values.yaml (see deployment/templates/quality-config
 * .yaml). Editing values + redeploying re-tunes them with no image rebuild.
 * The DEFAULTS below are the fallback for local dev / when the file is absent.
 */
import {
  tallyTiptap,
  minutesFromTally,
  WORDS_PER_MINUTE,
  SECONDS_PER_PLOT,
} from './readingTime.js'

/** Fallback knobs when no runtime config is injected. */
export const DEFAULTS = Object.freeze({
  // Ideal read length, minutes.
  targetMinutes: 10,
  // Ideal prose-time / data-time. 1 == "half and half".
  targetTextDataRatio: 1,
  // How far from target still counts as "on target" for suggestions.
  minutesTolerance: 3,
  ratioTolerance: 0.2,
  // Reading-time model (mirror readingTime.js defaults).
  wordsPerMinute: WORDS_PER_MINUTE,
  secondsPerPlot: SECONDS_PER_PLOT,
})

// Backwards-compatible named exports (the default values). Live code should
// prefer getQualityConfig() / the config returned by evaluateQuality().
export const TARGET_MINUTES = DEFAULTS.targetMinutes
export const TARGET_TEXT_DATA_RATIO = DEFAULTS.targetTextDataRatio
export const MINUTES_TOLERANCE = DEFAULTS.minutesTolerance
export const RATIO_TOLERANCE = DEFAULTS.ratioTolerance

function positiveNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Resolve the effective config: DEFAULTS overlaid with any valid positive
 * numeric overrides from window.__QUALITY_CONFIG__ (set by the deployment)
 * and then from an explicit `overrides` arg (used by tests). Read fresh each
 * call so a redeploy takes effect on the next page load.
 */
export function getQualityConfig(overrides = {}) {
  const runtime =
    (typeof globalThis !== 'undefined' && globalThis.__QUALITY_CONFIG__) || {}
  const out = { ...DEFAULTS }
  for (const key of Object.keys(DEFAULTS)) {
    out[key] = positiveNumber(runtime[key], out[key])
    out[key] = positiveNumber(overrides[key], out[key])
  }
  return out
}

/**
 * Reading-time score: target / (target + (minutes - target)^2). 1.0 at exactly
 * the target, symmetric, monotone-decreasing away from it. Range (0, 1].
 */
export function readingTimeScore(minutes, target = DEFAULTS.targetMinutes) {
  const d = Math.abs((Number(minutes) || 0) - target)
  return target / (target + d * d)
}

/**
 * Split a { words, plots } tally into its prose- vs data-reading-time
 * contributions, in minutes.
 */
export function splitMinutes({ words = 0, plots = 0 } = {}, opts = {}) {
  const wpm = positiveNumber(opts.wpm, WORDS_PER_MINUTE)
  const secondsPerPlot = positiveNumber(opts.secondsPerPlot, SECONDS_PER_PLOT)
  return {
    textMinutes: words / wpm,
    dataMinutes: (plots * secondsPerPlot) / 60,
  }
}

/**
 * Data-to-text balance score: 10 / (10 + (|target - text/data| * 10)^2).
 * 1.0 when text-time / data-time equals the target ratio, symmetric in the
 * ratio, monotone-decreasing away from it. A story with no data structures
 * (or a truly empty one) scores 0 — a data-based article must carry data.
 */
export function balanceScore(textMinutes, dataMinutes, target = DEFAULTS.targetTextDataRatio) {
  const t = Number(textMinutes) || 0
  const d = Number(dataMinutes) || 0
  if (d <= 0) return 0
  const dist = Math.abs(target - t / d) * 10
  return 10 / (10 + dist * dist)
}

/**
 * Suggestions keyed for i18n, driven by the honest minutes and the text/data
 * ratio against the (possibly tuned) config.
 */
export function suggestionsFor({ totalMinutes, textMinutes, dataMinutes }, config = getQualityConfig()) {
  const out = []
  if (totalMinutes > config.targetMinutes + config.minutesTolerance) {
    out.push('too_long_split', 'too_long_summarize')
  } else if (totalMinutes < config.targetMinutes - config.minutesTolerance) {
    out.push('too_short_explain', 'too_short_add_data')
  }
  if (dataMinutes <= 0) {
    if (!out.includes('too_short_add_data')) out.push('no_data_add_plots')
  } else {
    const ratio = textMinutes / dataMinutes
    if (ratio > config.targetTextDataRatio + config.ratioTolerance) {
      out.push('too_much_text_add_plots')
    } else if (ratio < config.targetTextDataRatio - config.ratioTolerance) {
      out.push('too_much_data_explain')
    }
  }
  return out
}

/**
 * Evaluate a v2 Tiptap document against the effective (tuned) config. Returns
 * the tally, honest total minutes, the prose/data split, both scores, the
 * ratio, i18n suggestion keys, and the config that was applied.
 */
export function evaluateQuality(doc, overrides = {}) {
  const config = getQualityConfig(overrides)
  const tally = tallyTiptap(doc)
  const totalMinutes = minutesFromTally(tally, {
    wpm: config.wordsPerMinute,
    secondsPerPlot: config.secondsPerPlot,
  })
  const { textMinutes, dataMinutes } = splitMinutes(tally, {
    wpm: config.wordsPerMinute,
    secondsPerPlot: config.secondsPerPlot,
  })
  const ratio = dataMinutes > 0 ? textMinutes / dataMinutes : Infinity
  return {
    config,
    tally,
    totalMinutes,
    textMinutes,
    dataMinutes,
    ratio,
    readingTimeScore: readingTimeScore(totalMinutes, config.targetMinutes),
    balanceScore: balanceScore(textMinutes, dataMinutes, config.targetTextDataRatio),
    suggestions: suggestionsFor({ totalMinutes, textMinutes, dataMinutes }, config),
  }
}
