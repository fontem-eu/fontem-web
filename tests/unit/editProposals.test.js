/**
 * Tests for the edit proposal validation logic.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/api/community.js', () => ({
  updateReport: vi.fn().mockResolvedValue({}),
}))
vi.mock('../../src/utils/sanitize.js', () => ({
  sanitizeHtml: vi.fn(x => x),
}))

import { validateProposal } from '../../src/composables/useEditProposals.js'

describe('validateProposal', () => {
  it('accepts add_section with content', () => {
    const r = validateProposal({ action: 'add_section', params: { content: '<p>hi</p>' } })
    expect(r.valid).toBe(true)
  })

  it('accepts insert_content with content', () => {
    const r = validateProposal({ action: 'insert_content', params: { content: 'text' } })
    expect(r.valid).toBe(true)
  })

  it('accepts update_title with title', () => {
    const r = validateProposal({ action: 'update_title', params: { title: 'New' } })
    expect(r.valid).toBe(true)
  })

  it('accepts update_abstract with abstract', () => {
    const r = validateProposal({ action: 'update_abstract', params: { abstract: 'Summary' } })
    expect(r.valid).toBe(true)
  })

  it('accepts insert_widget with widget_type and entityId', () => {
    const r = validateProposal({ action: 'insert_widget', params: { widget_type: 'graph_explorer', entityId: 'abc' } })
    expect(r.valid).toBe(true)
  })

  it('rejects unknown action', () => {
    const r = validateProposal({ action: 'delete_everything', params: {} })
    expect(r.valid).toBe(false)
    expect(r.error).toContain('Unknown action')
  })

  it('rejects missing required param', () => {
    const r = validateProposal({ action: 'add_section', params: {} })
    expect(r.valid).toBe(false)
    expect(r.error).toContain('Missing')
  })

  it('rejects insert_widget without entityId', () => {
    const r = validateProposal({ action: 'insert_widget', params: { widget_type: 'chart' } })
    expect(r.valid).toBe(false)
  })

  it('rejects null proposal', () => {
    expect(validateProposal(null).valid).toBe(false)
    expect(validateProposal(undefined).valid).toBe(false)
  })

  it('rejects non-object proposal', () => {
    expect(validateProposal('string').valid).toBe(false)
    expect(validateProposal(42).valid).toBe(false)
  })
})
