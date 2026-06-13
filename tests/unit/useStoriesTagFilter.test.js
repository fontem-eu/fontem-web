import { _internal } from '../../src/api/session.js'
import { describe, it, expect, beforeEach } from 'vitest'
import { useStoriesTagFilter } from '../../src/composables/useStoriesTagFilter.js'

describe('useStoriesTagFilter', () => {
  const KEY = 'gmr-stories-tag'

  beforeEach(() => {
    _internal.clearForTests(); localStorage.clear()
  })

  it('exposes the storage key (so tests + future migrations can target it)', () => {
    const { _STORAGE_KEY } = useStoriesTagFilter()
    expect(_STORAGE_KEY).toBe(KEY)
  })

  it('getStoredTag returns null when nothing is persisted', () => {
    const { getStoredTag } = useStoriesTagFilter()
    expect(getStoredTag()).toBeNull()
  })

  it('saveTag persists the value, getStoredTag reads it back verbatim', () => {
    const { saveTag, getStoredTag } = useStoriesTagFilter()
    saveTag('procurement')
    expect(getStoredTag()).toBe('procurement')
    expect(localStorage.getItem(KEY)).toBe('procurement')
  })

  it('saveTag overwrites the previous value', () => {
    const { saveTag, getStoredTag } = useStoriesTagFilter()
    saveTag('procurement')
    saveTag('lobbying')
    expect(getStoredTag()).toBe('lobbying')
  })

  it('saveTag(null) removes the key entirely (not a stored "null" string)', () => {
    const { saveTag, getStoredTag } = useStoriesTagFilter()
    saveTag('procurement')
    saveTag(null)
    expect(getStoredTag()).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('saveTag("") clears the key (treats empty as no filter)', () => {
    const { saveTag, getStoredTag } = useStoriesTagFilter()
    saveTag('procurement')
    saveTag('')
    expect(getStoredTag()).toBeNull()
  })

  it('clearStoredTag drops the persisted value', () => {
    const { saveTag, clearStoredTag, getStoredTag } = useStoriesTagFilter()
    saveTag('procurement')
    clearStoredTag()
    expect(getStoredTag()).toBeNull()
  })

  it('getStoredTag returns null when the stored value is the empty string (defensive)', () => {
    // Bypass the public API to plant a degenerate value directly.
    localStorage.setItem(KEY, '')
    const { getStoredTag } = useStoriesTagFilter()
    expect(getStoredTag()).toBeNull()
  })
})
