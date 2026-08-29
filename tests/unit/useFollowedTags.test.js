/**
 * useFollowedTags — localStorage for unauth, API for auth.
 */
import { _internal } from '../../src/api/session.js'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/api/community.js', () => ({
  listFollowedTags: vi.fn(() => Promise.resolve({ tags: ['procurement'] })),
  followTag: vi.fn((t) => Promise.resolve({ tag: t })),
  unfollowTag: vi.fn(() => Promise.resolve(null)),
}))

import {
  useFollowedTags,
  _resetFollowedTagsForTests,
  MAX_FOLLOWED_TAGS,
} from '../../src/composables/useFollowedTags.js'
import * as api from '../../src/api/community.js'

beforeEach(() => {
  _internal.clearForTests(); localStorage.clear()
  _resetFollowedTagsForTests()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useFollowedTags — unauthenticated', () => {
  it('starts empty when localStorage is fresh', async () => {
    const { tags, init } = useFollowedTags()
    await init()
    expect([...tags.value]).toEqual([])
  })

  it('persists follows to localStorage and survives a re-init', async () => {
    const u = useFollowedTags()
    await u.init()
    await u.follow('Public Expenditure')
    expect(JSON.parse(localStorage.getItem('gmr-followed-tags')))
      .toEqual(['public-expenditure'])

    // Re-init mimics a page reload — the new state hydrates from
    // localStorage (no server call expected — no token).
    _resetFollowedTagsForTests()
    const u2 = useFollowedTags()
    await u2.init()
    expect([...u2.tags.value]).toEqual(['public-expenditure'])
    expect(api.listFollowedTags).not.toHaveBeenCalled()
  })

  it('toggle flips follow ↔ unfollow', async () => {
    const u = useFollowedTags()
    await u.init()
    await u.toggle('procurement')
    expect(u.isFollowing('procurement')).toBe(true)
    await u.toggle('procurement')
    expect(u.isFollowing('procurement')).toBe(false)
  })

  it('respects the 50-tag cap', async () => {
    const u = useFollowedTags()
    await u.init()
    for (let i = 0; i < MAX_FOLLOWED_TAGS; i++) await u.follow(`tag-${i}`)
    await u.follow('overflow')
    expect(u.isFollowing('overflow')).toBe(false)
    expect(u.tags.value.length).toBe(MAX_FOLLOWED_TAGS)
  })
})

describe('useFollowedTags — authenticated', () => {
  beforeEach(() => {
    _internal.setAccessToken('fake.jwt.token')
  })

  it('hydrates from the API on init', async () => {
    const u = useFollowedTags()
    await u.init()
    expect(api.listFollowedTags).toHaveBeenCalled()
    expect([...u.tags.value]).toEqual(['procurement'])
  })

  it('follow hits the API and reflects the canonical slug back', async () => {
    api.followTag.mockResolvedValueOnce({ tag: 'public-expenditure' })
    const u = useFollowedTags()
    await u.init()
    await u.follow('Public Expenditure')
    expect(api.followTag).toHaveBeenCalledWith('public-expenditure')
    expect(u.isFollowing('public-expenditure')).toBe(true)
  })

  it('unfollow hits the API and updates state optimistically', async () => {
    const u = useFollowedTags()
    await u.init()
    await u.unfollow('procurement')
    expect(api.unfollowTag).toHaveBeenCalledWith('procurement')
    expect(u.isFollowing('procurement')).toBe(false)
  })

  it('does not write to localStorage when authenticated', async () => {
    const u = useFollowedTags()
    await u.init()
    await u.follow('public-expenditure')
    // Auth path doesn't touch localStorage for follows — server is the
    // source of truth. The token itself stays in localStorage.
    expect(localStorage.getItem('gmr-followed-tags')).toBeNull()
  })

  it('migrateLocalToServer pushes localStorage tags up + clears storage', async () => {
    // Stage: signed-out user followed two tags before logging in.
    _internal.clearForTests()
    _resetFollowedTagsForTests()
    let u = useFollowedTags()
    await u.init()
    await u.follow('procurement')
    await u.follow('lobbying')
    expect(JSON.parse(localStorage.getItem('gmr-followed-tags')))
      .toEqual(['procurement', 'lobbying'])

    // Now they sign in — token appears, migrate runs.
    _internal.setAccessToken('fake.jwt.token')
    // Two calls happen: init() reads the empty server-side state,
    // then migrate() pushes locals up and re-reads the merged list.
    api.listFollowedTags
      .mockResolvedValueOnce({ tags: [] })  // init — server has nothing yet
      .mockResolvedValue({ tags: ['procurement', 'lobbying'] })  // post-migrate
    _resetFollowedTagsForTests()
    u = useFollowedTags()
    await u.init()
    await u.migrateLocalToServer()
    expect(api.followTag).toHaveBeenCalledWith('procurement')
    expect(api.followTag).toHaveBeenCalledWith('lobbying')
    expect(localStorage.getItem('gmr-followed-tags')).toBeNull()
    expect([...u.tags.value]).toEqual(['procurement', 'lobbying'])
  })
})

// ── Mutation-hardening: slug normalisation + storage details ───────
describe('tag slug normalisation (via the public API)', () => {
  it('lowercases, hyphenates and trims edge hyphens', async () => {
    const u = useFollowedTags()
    await u.init()
    await u.follow('  Water Quality!  ')
    expect([...u.tags.value]).toEqual(['water-quality'])
    expect(u.isFollowing('WATER   quality')).toBe(true)
  })

  it('collapses runs of separators into one hyphen', async () => {
    const u = useFollowedTags()
    await u.init()
    await u.follow('a__b -- c')
    expect([...u.tags.value]).toEqual(['a-b-c'])
  })

  it('drops tags that normalise to nothing', async () => {
    const u = useFollowedTags()
    await u.init()
    await u.follow('!!!')
    await u.follow('')
    expect([...u.tags.value]).toEqual([])
  })

  it('caps slugs at 40 chars without a trailing hyphen', async () => {
    const u = useFollowedTags()
    await u.init()
    const long = 'aaaaaaaaaa bbbbbbbbbb cccccccccc ddddddddddddd'
    await u.follow(long)
    const slug = u.tags.value[0]
    expect(slug.length).toBeLessThanOrEqual(40)
    expect(slug.endsWith('-')).toBe(false)
    expect(slug.startsWith('aaaaaaaaaa-bbbbbbbbbb')).toBe(true)
  })

  it('never double-follows the same slug', async () => {
    const u = useFollowedTags()
    await u.init()
    await u.follow('water')
    await u.follow('Water!')
    expect([...u.tags.value]).toEqual(['water'])
  })
})

describe('local persistence details', () => {
  it('stores under gmr-followed-tags as a JSON array', async () => {
    const u = useFollowedTags()
    await u.init()
    await u.follow('water')
    expect(JSON.parse(localStorage.getItem('gmr-followed-tags'))).toEqual(['water'])
  })

  it('ignores corrupted or non-array stored values', async () => {
    localStorage.setItem('gmr-followed-tags', 'not json {')
    let u = useFollowedTags()
    await u.init()
    expect([...u.tags.value]).toEqual([])
    _resetFollowedTagsForTests()
    localStorage.setItem('gmr-followed-tags', JSON.stringify({ nope: 1 }))
    u = useFollowedTags()
    await u.init()
    expect([...u.tags.value]).toEqual([])
    _resetFollowedTagsForTests()
    localStorage.setItem('gmr-followed-tags', JSON.stringify(['ok', 42, null, 'fine']))
    u = useFollowedTags()
    await u.init()
    expect([...u.tags.value]).toEqual(['ok', 'fine'])
  })

  it('unfollow removes from storage too', async () => {
    const u = useFollowedTags()
    await u.init()
    await u.follow('water')
    await u.follow('energy')
    await u.unfollow('Water')
    expect([...u.tags.value]).toEqual(['energy'])
    expect(JSON.parse(localStorage.getItem('gmr-followed-tags'))).toEqual(['energy'])
  })
})
