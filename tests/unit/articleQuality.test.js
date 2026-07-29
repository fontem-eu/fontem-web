import { describe, it, expect } from 'vitest'
import {
  readingTimeScore,
  balanceScore,
  splitMinutes,
  suggestionsFor,
  evaluateQuality,
  TARGET_MINUTES,
  TARGET_TEXT_DATA_RATIO,
} from '../../src/utils/articleQuality.js'

describe('readingTimeScore — math behaviour', () => {
  it('peaks at exactly 1.0 at the target', () => {
    expect(readingTimeScore(TARGET_MINUTES)).toBe(1)
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

  it('decreases monotonically as it moves away from the target', () => {
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

  it('a 13- or 7-minute read scores ~0.53 (gentle near target)', () => {
    expect(readingTimeScore(13)).toBeCloseTo(10 / 19, 6)
    expect(readingTimeScore(7)).toBeCloseTo(10 / 19, 6)
  })
})

describe('balanceScore — math behaviour', () => {
  it('peaks at exactly 1.0 when text/data === the target ratio (0.5)', () => {
    // textMinutes = 1, dataMinutes = 2 -> ratio 0.5
    expect(balanceScore(1, 2)).toBe(1)
  })

  it('matches the closed form 10/(10 + (|0.5 - text/data|*10)^2)', () => {
    const cases = [[1, 2], [2, 2], [0, 3], [3, 2], [1, 4]]
    for (const [tm, dm] of cases) {
      const ratio = tm / dm
      const expected = 10 / (10 + (Math.abs(0.5 - ratio) * 10) ** 2)
      expect(balanceScore(tm, dm)).toBeCloseTo(expected, 12)
    }
  })

  it('is symmetric in the ratio about 0.5 (equal text/data == all-data)', () => {
    // ratio 1.0 (equal) and ratio 0.0 (all data) are equidistant from 0.5
    expect(balanceScore(2, 2)).toBeCloseTo(balanceScore(0, 2), 12)
  })

  it('scores 0 when there are no data structures', () => {
    expect(balanceScore(5, 0)).toBe(0)
  })

  it('scores 0 for an empty article (no text, no data)', () => {
    expect(balanceScore(0, 0)).toBe(0)
  })

  it('degrades as the ratio drifts from 0.5 in either direction', () => {
    const peak = balanceScore(1, 2) // ratio 0.5
    expect(balanceScore(0.7, 2)).toBeLessThan(peak) // 0.35
    expect(balanceScore(1.5, 2)).toBeLessThan(peak) // 0.75
  })
})

describe('splitMinutes', () => {
  it('splits a tally into prose and data minutes (data cancels the tax in the ratio)', () => {
    // 238 words = 1 min prose (before tax); 2 plots = 60s = 1 min data (before tax)
    const { textMinutes, dataMinutes } = splitMinutes({ words: 238, plots: 2 })
    expect(textMinutes).toBeCloseTo(1 * 1.1, 6)
    expect(dataMinutes).toBeCloseTo(1 * 1.1, 6)
    // ratio is tax-independent
    expect(textMinutes / dataMinutes).toBeCloseTo(1, 6)
  })

  it('no plots -> zero data minutes', () => {
    expect(splitMinutes({ words: 100, plots: 0 }).dataMinutes).toBe(0)
  })
})

describe('suggestionsFor', () => {
  it('too long -> split + summarize', () => {
    const s = suggestionsFor({ totalMinutes: 20, textMinutes: 5, dataMinutes: 10 })
    expect(s).toContain('too_long_split')
    expect(s).toContain('too_long_summarize')
  })

  it('too short -> explain more + add data', () => {
    const s = suggestionsFor({ totalMinutes: 3, textMinutes: 1, dataMinutes: 2 })
    expect(s).toContain('too_short_explain')
    expect(s).toContain('too_short_add_data')
  })

  it('on-length but too much prose -> add plots', () => {
    // ratio 2.0 (way above 0.5 target) at a good length
    const s = suggestionsFor({ totalMinutes: 10, textMinutes: 6, dataMinutes: 3 })
    expect(s).toContain('too_much_text_add_plots')
  })

  it('on-length but too much data -> explain more', () => {
    // ratio 0.1 (below 0.5 target)
    const s = suggestionsFor({ totalMinutes: 10, textMinutes: 0.5, dataMinutes: 5 })
    expect(s).toContain('too_much_data_explain')
  })

  it('no data at all -> add plots', () => {
    const s = suggestionsFor({ totalMinutes: 10, textMinutes: 10, dataMinutes: 0 })
    expect(s).toContain('no_data_add_plots')
  })

  it('a balanced ~10-min article yields no suggestions', () => {
    // ratio 0.5, ~10 min
    const s = suggestionsFor({ totalMinutes: 10, textMinutes: 3, dataMinutes: 6 })
    expect(s).toEqual([])
  })
})

describe('evaluateQuality — end to end on a doc', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'one two three four five' }] },
      { type: 'widget', attrs: { widget_type: 'viz' } },
      { type: 'table', content: [] },
    ],
  }

  it('returns tally, minutes, split, both scores and suggestions', () => {
    const r = evaluateQuality(doc)
    expect(r.tally).toEqual({ words: 5, plots: 2 })
    expect(r.totalMinutes).toBeGreaterThanOrEqual(1)
    expect(r.readingTimeScore).toBeGreaterThan(0)
    expect(r.readingTimeScore).toBeLessThanOrEqual(1)
    expect(r.balanceScore).toBeGreaterThan(0)
    expect(Array.isArray(r.suggestions)).toBe(true)
  })

  it('flags an on-length but data-less article: balanceScore 0 and add-plots', () => {
    // ~2200 words of prose, no widgets/tables -> ~10 min, but no data
    const words = Array.from({ length: 2200 }, () => 'word').join(' ')
    const proseOnly = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: words }] }],
    }
    const r = evaluateQuality(proseOnly)
    expect(r.balanceScore).toBe(0)
    expect(r.suggestions).toContain('no_data_add_plots')
  })

  it('uses the exported constants', () => {
    expect(TARGET_MINUTES).toBe(10)
    expect(TARGET_TEXT_DATA_RATIO).toBe(0.5)
  })
})
