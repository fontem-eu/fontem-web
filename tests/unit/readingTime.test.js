import { describe, it, expect } from 'vitest'
import {
  tallyTiptap,
  tallyLegacySections,
  minutesFromTally,
  WORDS_PER_MINUTE,
  SECONDS_PER_PLOT,
} from '../../src/utils/readingTime.js'

describe('readingTime', () => {
  it('counts words in nested tiptap nodes; widgets AND tables are plots', () => {
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
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'six seven' }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    // words: 3 + 2 + 2 (table cell text still reads) = 7; plots: 2 widgets + 1 table = 3
    expect(tallyTiptap(doc)).toEqual({ words: 7, plots: 3 })
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

  it('counts legacy tables — markdown pipe-tables and rendered HTML', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |'
    expect(tallyLegacySections([{ content: md }]).plots).toBe(1)
    const html = '<table><tr><td>x</td></tr></table>'
    expect(tallyLegacySections([{ content: html }]).plots).toBe(1)
    // a plain pipe in prose is not a table
    expect(tallyLegacySections([{ content: 'a | b divider' }]).plots).toBe(0)
  })

  it('rounds to nearest minute and never returns less than 1', () => {
    expect(minutesFromTally({ words: 0, plots: 0 })).toBe(1)
    expect(minutesFromTally({ words: 10, plots: 0 })).toBe(1)
    expect(minutesFromTally({ words: WORDS_PER_MINUTE, plots: 0 })).toBe(1)
  })

  it('applies the ~10% cognitive-complexity tax on the whole estimate', () => {
    // 2000 words / 238 wpm = ~504s -> 8 min raw; +10% = ~555s -> 9 min
    expect(minutesFromTally({ words: 2000, plots: 0 }, { complexityTax: 0 })).toBe(8)
    expect(minutesFromTally({ words: 2000, plots: 0 })).toBe(9)
  })

  it('adds SECONDS_PER_PLOT per plot (widget or table)', () => {
    // 0 words + 2 plots * 30s = 60s, +10% = 66s -> 1 min
    expect(minutesFromTally({ words: 0, plots: 2 })).toBe(1)
    expect(SECONDS_PER_PLOT).toBe(30)
  })
})
