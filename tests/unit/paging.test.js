import { describe, it, expect, vi } from 'vitest'
import { PAGE_SIZE, MAX_PAGE_SIZE, cursorOf, mayHaveMore, pageQuery, appendPage, fetchAll } from '../../src/utils/paging.js'

describe('paging utils (the community API keyset contract)', () => {
  it('uses the page sizes the API defaults to, and its caps', () => {
    expect(PAGE_SIZE).toEqual({ projects: 30, investigations: 10 })
    expect(MAX_PAGE_SIZE).toEqual({ projects: 200, investigations: 500 })
  })

  it('builds the cursor from the last row, and nothing from nothing', () => {
    expect(cursorOf({ id: 'a', updated_at: '2026-09-26T12:00:00Z' })).toBe('2026-09-26T12:00:00Z|a')
    expect(cursorOf(undefined)).toBe('')
    expect(cursorOf({ id: 'a' })).toBe('')
  })

  it('reads "more" only from an exactly full page', () => {
    expect(mayHaveMore(new Array(30).fill({}), 30)).toBe(true)
    expect(mayHaveMore(new Array(29).fill({}), 30)).toBe(false)
    // An API that predates paging ignores the limit and sends everything.
    // That is the whole list, not a page with more after it.
    expect(mayHaveMore(new Array(1147).fill({}), 30)).toBe(false)
    expect(mayHaveMore(null, 30)).toBe(false)
  })

  it('encodes the cursor and keeps extra filters', () => {
    expect(pageQuery({ limit: 30 })).toBe('?limit=30')
    expect(pageQuery({ limit: 30, before: '2026-09-26T12:00:00+00:00|a' }))
      .toBe('?limit=30&before=2026-09-26T12%3A00%3A00%2B00%3A00%7Ca')
    expect(pageQuery({ limit: 30 }, { investigation_id: 'i/1' })).toBe('?investigation_id=i%2F1&limit=30')
    expect(pageQuery()).toBe('')
  })

  it('appends a page without repeating rows already shown', () => {
    expect(appendPage([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]).map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(appendPage([{ id: 'a' }], null)).toEqual([{ id: 'a' }])
  })

  describe('fetchAll (the pickers)', () => {
    const rows = (n) => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, updated_at: `t${1000 - i}` }))
    const server = (all) => vi.fn(async ({ limit, before }) => {
      const start = before ? all.findIndex((r) => `${r.updated_at}|${r.id}` === before) + 1 : 0
      return all.slice(start, start + limit)
    })

    it('walks every page at the given size', async () => {
      const fetchPage = server(rows(12))
      const got = await fetchAll(fetchPage, 5)
      expect(got.map((r) => r.id)).toEqual(rows(12).map((r) => r.id))
      expect(fetchPage.mock.calls.map(([q]) => q.limit)).toEqual([5, 5, 5])
    })

    it('makes one extra call, not an endless one, when the total is a multiple of the page', async () => {
      const fetchPage = server(rows(10))
      expect((await fetchAll(fetchPage, 5)).length).toBe(10)
      expect(fetchPage).toHaveBeenCalledTimes(3)
    })

    it('stops against an API that ignores the cursor', async () => {
      const all = rows(5)
      const fetchPage = vi.fn(async () => all.slice(0, 5))
      expect((await fetchAll(fetchPage, 5)).length).toBe(5)
      expect(fetchPage).toHaveBeenCalledTimes(2)
    })
  })
})
