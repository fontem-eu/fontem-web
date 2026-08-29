/**
 * Tests for the client viz registry (type → data endpoint binding).
 */
import { describe, it, expect } from 'vitest'
import { resolveVizEndpoint, VIZ_ENDPOINTS } from '../../src/widgets/viz_registry.js'

describe('resolveVizEndpoint', () => {
  it('builds the bidder-breakdown endpoint with an encoded entity id', () => {
    expect(resolveVizEndpoint('company_bidder_breakdown', { entity_id: 'x/1' }))
      .toBe('/api/viz/company-bidder-breakdown?entity_id=x%2F1')
  })

  it('tolerates missing data params', () => {
    expect(resolveVizEndpoint('company_bidder_breakdown'))
      .toBe('/api/viz/company-bidder-breakdown?entity_id=')
    expect(resolveVizEndpoint('company_bidder_breakdown', {}))
      .toBe('/api/viz/company-bidder-breakdown?entity_id=')
  })

  it('returns null for unknown types', () => {
    expect(resolveVizEndpoint('nope', {})).toBeNull()
  })

  it('every registered builder produces a /api/viz/ URL', () => {
    for (const build of Object.values(VIZ_ENDPOINTS)) {
      expect(build({})).toMatch(/^\/api\/viz\//)
    }
  })
})
