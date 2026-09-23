import { describe, expect, it } from 'vitest'

import { STORY_EVERY, feedKey, interleaveFeed } from '../../src/utils/feedOrder.js'

const briefings = (n) => Array.from({ length: n }, (_, i) => ({ item_id: `b${i}`, _from: 'B' }))
const stories = (n) => Array.from({ length: n }, (_, i) => ({ id: `s${i}` }))

const shape = (out) => out.map((e) => e.kind[0]).join('')

describe('interleaveFeed', () => {
  it('puts one story after every N briefings', () => {
    expect(shape(interleaveFeed(briefings(10), stories(2), 5)))
      .toBe('bbbbb' + 's' + 'bbbbb' + 's')
  })

  it('keeps each kind newest-first', () => {
    const out = interleaveFeed(briefings(6), stories(2), 3)
    expect(out.filter((e) => e.kind === 'briefing').map((e) => e.item.item_id))
      .toEqual(['b0', 'b1', 'b2', 'b3', 'b4', 'b5'])
    expect(out.filter((e) => e.kind === 'story').map((e) => e.item.id))
      .toEqual(['s0', 's1'])
  })

  it('appends the stories that no briefing run reached', () => {
    // 2 briefings never complete a run of 5, so without the tail pass
    // every story would be dropped and the feed would look briefing-only.
    const out = interleaveFeed(briefings(2), stories(3), 5)
    expect(shape(out)).toBe('bbsss')
  })

  it('emits nothing but briefings when there are no stories', () => {
    expect(shape(interleaveFeed(briefings(7), [], 5))).toBe('bbbbbbb')
  })

  it('emits nothing but stories when there are no briefings', () => {
    expect(shape(interleaveFeed([], stories(3), 5))).toBe('sss')
  })

  it('stops inserting once the stories run out', () => {
    expect(shape(interleaveFeed(briefings(12), stories(1), 5))).toBe('bbbbbsbbbbbbb')
  })

  it('survives absent lists', () => {
    expect(interleaveFeed(undefined, null)).toEqual([])
  })

  it('refuses a cadence that would never advance', () => {
    expect(() => interleaveFeed(briefings(1), stories(1), 0)).toThrow()
  })

  it('defaults to a cadence a reader meets without looking for it', () => {
    expect(STORY_EVERY).toBeGreaterThanOrEqual(5)
    expect(STORY_EVERY).toBeLessThanOrEqual(6)
  })

  it('keys briefings by source and item, so one record in two briefings is two entries', () => {
    const a = feedKey({ kind: 'briefing', item: { _from: 'A', item_id: '1' } })
    const b = feedKey({ kind: 'briefing', item: { _from: 'B', item_id: '1' } })
    expect(a).not.toBe(b)
    expect(feedKey({ kind: 'story', item: { id: '1' } })).toBe('story::1')
  })
})

describe('interleaveFeed while more stories are still to come', () => {
  it('stops at the first story slot it cannot fill', () => {
    const out = interleaveFeed(briefings(20), stories(1), 5, { storiesComplete: false })
    // b0-b4, s0, b5-b9, then a slot with no story: stop there.
    expect(shape(out)).toBe('bbbbbsbbbbb')
  })

  it('never changes what it already emitted when the next page of stories arrives', () => {
    // The property the reader sees: nothing already on screen moves.
    const b = briefings(40)
    const page1 = stories(3)
    const page2 = [...page1, ...stories(6).slice(3)]
    const before = interleaveFeed(b, page1, 5, { storiesComplete: false })
    const after = interleaveFeed(b, page2, 5, { storiesComplete: false })
    expect(after.slice(0, before.length)).toEqual(before)
    expect(after.length).toBeGreaterThan(before.length)
  })

  it('once the stories are exhausted, runs on through the remaining briefings', () => {
    const out = interleaveFeed(briefings(12), stories(1), 5, { storiesComplete: true })
    expect(shape(out)).toBe('bbbbbsbbbbbbb')
  })

  it('without briefings, shows whatever stories are loaded', () => {
    expect(shape(interleaveFeed([], stories(4), 5, { storiesComplete: false }))).toBe('ssss')
  })
})
