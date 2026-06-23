import { describe, it, expect } from 'vitest'
import { roleLabel, roleAtLeast, canContribute } from '../../src/utils/investigationRole.js'

describe('roleLabel', () => {
  it('null membership -> Viewer', () => expect(roleLabel(null)).toBe('Viewer'))
  it('owner -> Owner', () => expect(roleLabel({ role: 'owner' })).toBe('Owner'))
  it('admin -> Admin', () => expect(roleLabel({ role: 'admin' })).toBe('Admin'))
  it('contributor -> Contributor', () => expect(roleLabel({ role: 'contributor' })).toBe('Contributor'))
  it('viewer -> Viewer', () => expect(roleLabel({ role: 'viewer' })).toBe('Viewer'))
  it('unknown -> Viewer', () => expect(roleLabel({ role: 'nope' })).toBe('Viewer'))
})

describe('roleAtLeast / canContribute', () => {
  it('rank ordering', () => {
    expect(roleAtLeast({ role: 'owner' }, 'admin')).toBe(true)
    expect(roleAtLeast({ role: 'admin' }, 'admin')).toBe(true)
    expect(roleAtLeast({ role: 'contributor' }, 'admin')).toBe(false)
    expect(roleAtLeast(null, 'viewer')).toBe(false)
  })
  it('canContribute = contributor+', () => {
    expect(canContribute({ role: 'viewer' })).toBe(false)
    expect(canContribute({ role: 'contributor' })).toBe(true)
    expect(canContribute({ role: 'owner' })).toBe(true)
    expect(canContribute(null)).toBe(false)
  })
})
