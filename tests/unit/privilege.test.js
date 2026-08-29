/**
 * Tests for the isPrivileged predicate (admin-area UX hint).
 * Mirrors the backend policy: explicit role OR trust level at the bar.
 */
import { describe, it, expect } from 'vitest'
import { isPrivileged } from '../../src/utils/privilege.js'

describe('isPrivileged', () => {
  it('is false for missing users', () => {
    expect(isPrivileged(null)).toBe(false)
    expect(isPrivileged(undefined)).toBe(false)
  })

  it('is true for moderator and admin trust levels', () => {
    expect(isPrivileged({ trust_level: 'moderator' })).toBe(true)
    expect(isPrivileged({ trust_level: 'admin' })).toBe(true)
  })

  it('is false for ordinary trust levels', () => {
    expect(isPrivileged({ trust_level: 'member' })).toBe(false)
    expect(isPrivileged({ trust_level: '' })).toBe(false)
    expect(isPrivileged({})).toBe(false)
  })

  it('honours explicit role assignments even without trust level', () => {
    expect(isPrivileged({ roles: ['moderator'] })).toBe(true)
    expect(isPrivileged({ roles: ['admin'] })).toBe(true)
    expect(isPrivileged({ roles: ['editor', 'admin'] })).toBe(true)
  })

  it('is false when no role qualifies', () => {
    expect(isPrivileged({ roles: ['editor'] })).toBe(false)
    expect(isPrivileged({ roles: [] })).toBe(false)
    expect(isPrivileged({ trust_level: 'member', roles: ['viewer'] })).toBe(false)
  })
})
