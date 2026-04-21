/**
 * Smoke test for ConsolidationView — verify each card surface includes
 * the rule name + confidence + detected_at, and that decide() POSTs to
 * the right URL.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ConsolidationView from '../../src/views/ConsolidationView.vue'

const FAKE_RULES = [
  { name: 'exact_lei_match', entity_types: ['Company'], confidence: 1.0, action: 'merge' },
  { name: 'fuzzy_name_same_country', entity_types: ['Company'], confidence: 0.9, action: 'flag' },
]

const FAKE_CANDIDATES = [
  {
    from_id: 'gmr-A',
    to_id: 'gmr-B',
    entity_type: 'Company',
    rule_name: 'fuzzy_name_same_country',
    confidence: 0.87,
    detected_at: '2026-04-21T12:00:00Z',
    conflict: false,
    source_entity: { name: 'Acme', country: 'FR' },
    target_entity: { name: 'ACME Inc.', country: 'FR' },
  },
]

beforeEach(() => {
  global.fetch = vi.fn(async (url, opts) => {
    if (url.includes('/rules')) {
      return { ok: true, json: async () => FAKE_RULES }
    }
    if (url.includes('/candidates') && (!opts || opts.method !== 'POST')) {
      return { ok: true, json: async () => FAKE_CANDIDATES }
    }
    if (url.includes('/decide')) {
      return { ok: true, json: async () => ({ decision_id: 'd-1' }) }
    }
    return { ok: false, status: 404 }
  })
})

afterEach(() => { vi.restoreAllMocks() })

describe('ConsolidationView', () => {
  it('renders each card with rule name, confidence and timestamp', async () => {
    const wrapper = mount(ConsolidationView, { global: { stubs: { ThemeToggle: true } } })
    await flushPromises()
    const html = wrapper.html()
    expect(html).toContain('fuzzy_name_same_country')
    expect(html).toContain('conf 0.87')
    expect(html).toContain('gmr-A')
    expect(html).toContain('gmr-B')
    // The detected_at should appear (locale-formatted, contains "2026")
    expect(html).toMatch(/2026/)
  })

  it('POSTs to /decide and removes the card on Merge', async () => {
    const wrapper = mount(ConsolidationView, { global: { stubs: { ThemeToggle: true } } })
    await flushPromises()
    expect(wrapper.findAll('.card').length).toBe(1)

    const buttons = wrapper.findAll('button.primary')
    expect(buttons.length).toBe(1)
    await buttons[0].trigger('click')
    await flushPromises()

    const decideCall = global.fetch.mock.calls.find(([u]) => String(u).includes('/decide'))
    expect(decideCall).toBeTruthy()
    expect(decideCall[0]).toContain('/api/consolidator/candidates/gmr-A/gmr-B/decide')
    expect(decideCall[1].method).toBe('POST')
    const body = JSON.parse(decideCall[1].body)
    expect(body.decision).toBe('merge')

    // Card removed after success
    expect(wrapper.findAll('.card').length).toBe(0)
  })
})
