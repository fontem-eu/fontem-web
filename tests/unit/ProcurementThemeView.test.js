/**
 * ProcurementThemeView: the procurement theme landing composes the
 * value-quality + by-country endpoints into a confidence-gated headline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

import ProcurementThemeView from '../../src/views/themes/ProcurementThemeView.vue'

const stubs = {
  ThemeToggle: true,
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  StatCard: { props: ['value', 'label'], template: '<div class="stat">{{ label }}:{{ value }}</div>' },
  HorizontalBarChart: { props: ['data'], template: '<div class="bars">{{ data.length }}</div>' },
  SourcePipelinePanel: true,
}

function mockFetch(vq, bc) {
  global.fetch = vi.fn((url) => {
    const body = url.includes('value-quality') ? vq : bc
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
  })
}

beforeEach(() => vi.restoreAllMocks())

describe('ProcurementThemeView', () => {
  it('shows a confidence-gated headline and country spend', async () => {
    mockFetch(
      { total: 1000, flagged_low_confidence: 100, low_confidence_pct: 10,
        by_flag: [{ flag: 'ok', count: 900 }, { flag: 'implausible_magnitude', count: 1 }] },
      [{ country: 'FRA', contracts: 10, total_eur: 5_000_000_000 },
       { country: 'DEU', contracts: 8, total_eur: 3_000_000_000 }],
    )
    const w = mount(ProcurementThemeView, { global: { stubs } })
    await flushPromises()
    const text = w.text()
    expect(text).toContain('Contracts:1,000')
    expect(text).toContain('Trusted value:€8.0B')   // 5B + 3B gated sum
    expect(text).toContain('Values trusted:90%')     // 1 - 100/1000
    expect(text).toContain('Countries:2')
    // country bars + one non-ok flag bar rendered
    expect(w.findAll('.bars').length).toBe(2)
  })
})
