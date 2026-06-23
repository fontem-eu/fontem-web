import { describe, it, expect } from 'vitest'
import { roleLabel } from '../../src/utils/investigationRole.js'

describe('roleLabel', () => {
  it('null membership -> Viewer', () => expect(roleLabel(null)).toBe('Viewer'))
  it('owner -> Owner', () => expect(roleLabel({ is_owner: true, can_administer: true })).toBe('Owner'))
  it('administer -> Admin', () => expect(roleLabel({ can_administer: true })).toBe('Admin'))
  it('write_stories -> Contributor', () => expect(roleLabel({ can_write_stories: true })).toBe('Contributor'))
  it('add_viz -> Contributor', () => expect(roleLabel({ can_add_viz: true })).toBe('Contributor'))
  it('no caps -> Member', () => expect(roleLabel({})).toBe('Member'))
})
