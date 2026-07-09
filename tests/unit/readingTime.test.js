import { describe, it, expect } from 'vitest'
import {
  tallyTiptap,
  tallyLegacySections,
  minutesFromTally,
  WORDS_PER_MINUTE,
  SECONDS_PER_PLOT,
} from '../../src/utils/readingTime.js'

describe('readingTime', () => {
  it('counts words in nested tiptap text nodes and widget plots', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'one two three' }] },
        { type: 'widget', attrs: { widget_type: 'atlas' } },
        {
          type: 'blockquote',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'four five' }] },
          ],
        },
        { type: 'widget', attrs: { widget_type: 'corr' } },
      ],
    }
    expect(tallyTiptap(doc)).toEqual({ words: 5, plots: 2 })
  })

  it('handles an empty / missing doc without throwing', () => {
    expect(tallyTiptap(null)).toEqual({ words: 0, plots: 0 })
    expect(tallyTiptap({ type: 'doc' })).toEqual({ words: 0, plots: 0 })
  })

  it('tallies legacy sections: strips html/markdown, counts widget fences', () => {
    const sections = [
      { content: '# Title\n\nSome **bold** words here.' },
      { content: '<p>Two more</p>\n```widget\n{"widget_type":"map"}\n```' },
    ]
    // "Title Some bold words here" (5) + "Two more" (2) = 7 words, 1 plot
    expect(tallyLegacySections(sections)).toEqual({ words: 7, plots: 1 })
  })

  it('rounds to nearest minute and never returns less than 1', () => {
    expect(minutesFromTally({ words: 0, plots: 0 })).toBe(1)
    expect(minutesFromTally({ words: 10, plots: 0 })).toBe(1)
    // 238 words = exactly 1 min of prose
    expect(minutesFromTally({ words: WORDS_PER_MINUTE, plots: 0 })).toBe(1)
    // 476 words (2 min) + 4 plots (120s = 2 min) = 4 min
    expect(minutesFromTally({ words: 2 * WORDS_PER_MINUTE, plots: 4 })).toBe(4)
  })

  it('adds SECONDS_PER_PLOT per plot', () => {
    // 0 words + 2 plots * 30s = 60s = 1 min
    expect(minutesFromTally({ words: 0, plots: 2 })).toBe(1)
    expect(SECONDS_PER_PLOT).toBe(30)
  })
})
