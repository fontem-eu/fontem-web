/**
 * Scroll restoration on back.
 *
 * Before this existed the router was created with only `history` and
 * `routes`, so vue-router handed us `savedPosition` on every pop and we
 * never took the argument. Returning from a contract or a briefing put
 * the reader at the top of the feed, wherever they had scrolled to.
 */
import { describe, it, expect } from 'vitest'

import { scrollBehavior } from '../../src/router/scrollBehavior.js'

describe('scrollBehavior', () => {
  it('returns to where the reader was on a back navigation', () => {
    const saved = { top: 2480, left: 0 }

    expect(scrollBehavior({ path: '/' }, { path: '/contract/x' }, saved)).toBe(saved)
  })

  it('starts a pushed page at the top', () => {
    // savedPosition is null for a push: this is a page they have not
    // seen, not a return to one they had.
    expect(scrollBehavior({ path: '/contract/x' }, { path: '/' }, null)).toEqual({ top: 0 })
  })

  it('prefers the saved position over an anchor when both are present', () => {
    // Going back to a URL that happens to carry a hash should still land
    // where they were reading, not jump to the anchor a second time.
    const saved = { top: 900, left: 0 }

    expect(scrollBehavior({ path: '/about', hash: '#team' }, {}, saved)).toBe(saved)
  })

  it('honours an anchor on a fresh navigation', () => {
    expect(scrollBehavior({ path: '/about', hash: '#team' }, {}, null)).toEqual({ el: '#team' })
  })

  it('survives a route object with no hash key at all', () => {
    expect(scrollBehavior({}, {}, null)).toEqual({ top: 0 })
    expect(scrollBehavior(undefined, undefined, null)).toEqual({ top: 0 })
  })
})
