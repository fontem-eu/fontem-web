import { describe, it, expect, afterEach } from 'vitest'
import {
  readingTimeScore,
  balanceScore,
  splitMinutes,
  suggestionsFor,
  evaluateQuality,
  getQualityConfig,
  DEFAULTS,
  TARGET_MINUTES,
  TARGET_TEXT_DATA_RATIO,
} from '../../src/utils/articleQuality.js'

afterEach(() => {
  delete globalThis.__QUALITY_CONFIG__
})

describe('readingTimeScore — math behaviour', () => {
  it('peaks at exactly 1.0 at the target', () => {
    expect(readingTimeScore(10)).toBe(1)
  })
  it('matches the closed form 10/(10 + (t-10)^2)', () => {
    for (const t of [0, 3, 7, 10, 13, 20, 45]) {
      expect(readingTimeScore(t)).toBeCloseTo(10 / (10 + (t - 10) ** 2), 12)
    }
  })
  it('is symmetric about the target', () => {
    for (const d of [1, 2, 5, 8]) {
      expect(readingTimeScore(10 - d)).toBeCloseTo(readingTimeScore(10 + d), 12)
    }
  })
  it('decreases monotonically away from the target', () => {
    let prev = readingTimeScore(10)
    for (const t of [11, 12, 14, 18, 25, 40]) {
      const s = readingTimeScore(t)
      expect(s).toBeLessThan(prev)
      prev = s
    }
  })
  it('stays in (0, 1] and never hits 0', () => {
    for (const t of [0, 1, 10, 100, 1000]) {
      const s = readingTimeScore(t)
      expect(s).toBeGreaterThan(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })
  it('honours a custom target (tunable)', () => {
    expect(readingTimeScore(6, 6)).toBe(1)
    expect(readingTimeScore(10, 6)).toBeCloseTo(6 / (6 + 16), 12)
  })
})

describe('balanceScore — math behaviour (target ratio 1.0 == half and half)', () => {
  it('peaks at 1.0 when text-time equals data-time', () => {
    expect(balanceScore(2, 2)).toBe(1)
    expect(balanceScore(5, 5)).toBe(1)
  })
  it('matches the closed form 10/(10 + (|target - text/data|*10)^2)', () => {
    for (const [tm, dm, target] of [[2, 2, 1], [1, 2, 1], [3, 2, 1], [1, 2, 0.5]]) {
      const expected = 10 / (10 + (Math.abs(target - tm / dm) * 10) ** 2)
      expect(balanceScore(tm, dm, target)).toBeCloseTo(expected, 12)
    }
  })
  it('is symmetric in the ratio about the target (1.0)', () => {
    // ratio 0.0 and ratio 2.0 are equidistant from 1.0
    expect(balanceScore(0, 2)).toBeCloseTo(balanceScore(4, 2), 12)
  })
  it('scores 0 with no data structures, and for an empty article', () => {
    expect(balanceScore(5, 0)).toBe(0)
    expect(balanceScore(0, 0)).toBe(0)
  })
  it('degrades as the ratio drifts from 1.0 either way', () => {
    const peak = balanceScore(2, 2)
    expect(balanceScore(1, 2)).toBeLessThan(peak) // 0.5
    expect(balanceScore(3, 2)).toBeLessThan(peak) // 1.5
  })
  it('honours a custom target ratio (tunable back to 0.5)', () => {
    expect(balanceScore(1, 2, 0.5)).toBe(1)
  })
})

describe('splitMinutes', () => {
  it('splits a tally into prose and data minutes', () => {
    // 238 words = 1 min prose; 2 plots = 60s = 1 min data
    const { textMinutes, dataMinutes } = splitMinutes({ words: 238, plots: 2 })
    expect(textMinutes).toBeCloseTo(1, 6)
    expect(dataMinutes).toBeCloseTo(1, 6)
    expect(textMinutes / dataMinutes).toBeCloseTo(1, 6)
  })
  it('honours wpm / secondsPerPlot overrides', () => {
    const { textMinutes, dataMinutes } = splitMinutes({ words: 200, plots: 2 }, { wpm: 100, secondsPerPlot: 60 })
    expect(textMinutes).toBeCloseTo(2, 6)   // 200/100
    expect(dataMinutes).toBeCloseTo(2, 6)   // 2*60/60
  })
  it('no plots -> zero data minutes', () => {
    expect(splitMinutes({ words: 100, plots: 0 }).dataMinutes).toBe(0)
  })
})

describe('getQualityConfig — runtime tuning', () => {
  it('returns the defaults when nothing is injected', () => {
    expect(getQualityConfig()).toEqual({ ...DEFAULTS })
  })
  it('overlays valid positive numeric overrides from window.__QUALITY_CONFIG__', () => {
    globalThis.__QUALITY_CONFIG__ = { targetMinutes: 8, targetTextDataRatio: 0.5, wordsPerMinute: 200 }
    const c = getQualityConfig()
    expect(c.targetMinutes).toBe(8)
    expect(c.targetTextDataRatio).toBe(0.5)
    expect(c.wordsPerMinute).toBe(200)
    expect(c.secondsPerPlot).toBe(DEFAULTS.secondsPerPlot) // untouched
  })
  it('ignores non-numeric / non-positive garbage and falls back to defaults', () => {
    globalThis.__QUALITY_CONFIG__ = { targetMinutes: 'lots', targetTextDataRatio: -1, minutesTolerance: null }
    const c = getQualityConfig()
    expect(c.targetMinutes).toBe(DEFAULTS.targetMinutes)
    expect(c.targetTextDataRatio).toBe(DEFAULTS.targetTextDataRatio)
    expect(c.minutesTolerance).toBe(DEFAULTS.minutesTolerance)
  })
  it('an explicit overrides arg wins over the window config', () => {
    globalThis.__QUALITY_CONFIG__ = { targetMinutes: 8 }
    expect(getQualityConfig({ targetMinutes: 12 }).targetMinutes).toBe(12)
  })
})

describe('suggestionsFor', () => {
  it('too long -> split + summarize', () => {
    const s = suggestionsFor({ totalMinutes: 20, textMinutes: 5, dataMinutes: 5 })
    expect(s).toContain('too_long_split')
    expect(s).toContain('too_long_summarize')
  })
  it('too short -> explain more + add data', () => {
    const s = suggestionsFor({ totalMinutes: 3, textMinutes: 1, dataMinutes: 1 })
    expect(s).toContain('too_short_explain')
    expect(s).toContain('too_short_add_data')
  })
  it('on-length but too much prose -> add plots (ratio 2.0 > 1.0)', () => {
    const s = suggestionsFor({ totalMinutes: 10, textMinutes: 6, dataMinutes: 3 })
    expect(s).toContain('too_much_text_add_plots')
  })
  it('on-length but too much data -> explain more (ratio 0.3 < 1.0)', () => {
    const s = suggestionsFor({ totalMinutes: 10, textMinutes: 1.5, dataMinutes: 5 })
    expect(s).toContain('too_much_data_explain')
  })
  it('no data at all -> add plots', () => {
    const s = suggestionsFor({ totalMinutes: 10, textMinutes: 10, dataMinutes: 0 })
    expect(s).toContain('no_data_add_plots')
  })
  it('a balanced ~10-min article (ratio 1.0) yields no suggestions', () => {
    const s = suggestionsFor({ totalMinutes: 10, textMinutes: 5, dataMinutes: 5 })
    expect(s).toEqual([])
  })
  it('respects a tuned config (target ratio 0.5 makes 0.5 balanced)', () => {
    const cfg = getQualityConfig({ targetTextDataRatio: 0.5 })
    const s = suggestionsFor({ totalMinutes: 10, textMinutes: 3, dataMinutes: 6 }, cfg)
    expect(s).toEqual([])
  })
})

describe('evaluateQuality — end to end', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'one two three four five' }] },
      { type: 'widget', attrs: { widget_type: 'viz' } },
      { type: 'table', content: [] },
    ],
  }
  it('returns tally, minutes, split, scores, suggestions and the applied config', () => {
    const r = evaluateQuality(doc)
    expect(r.tally).toEqual({ words: 5, plots: 2 })
    expect(r.config.targetTextDataRatio).toBe(1)
    expect(r.readingTimeScore).toBeGreaterThan(0)
    expect(r.balanceScore).toBeGreaterThan(0)
    expect(Array.isArray(r.suggestions)).toBe(true)
  })
  it('picks up an injected runtime config', () => {
    globalThis.__QUALITY_CONFIG__ = { targetMinutes: 4 }
    expect(evaluateQuality(doc).config.targetMinutes).toBe(4)
  })
  it('flags an on-length but data-less article: balanceScore 0 + add-plots', () => {
    const words = Array.from({ length: 2200 }, () => 'word').join(' ')
    const r = evaluateQuality({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: words }] }] })
    expect(r.balanceScore).toBe(0)
    expect(r.suggestions).toContain('no_data_add_plots')
  })
  it('exports 1.0 as the default target ratio (half and half)', () => {
    expect(TARGET_MINUTES).toBe(10)
    expect(TARGET_TEXT_DATA_RATIO).toBe(1)
  })
})
