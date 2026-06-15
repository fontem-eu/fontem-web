/**
 * DataQualityBadge + contractValueConcerns: a contract flagged by the
 * ETL confidence scorer must surface a badge; a clean contract must not.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k) => k }) }))

import DataQualityBadge from '../../src/components/DataQualityBadge.vue'
import { contractValueConcerns } from '../../src/utils/dataQuality.js'

describe('contractValueConcerns', () => {
  it('returns no concerns for a clean contract', () => {
    expect(contractValueConcerns({ value_eur: 1000 })).toEqual([])
  })

  it('flags a low-confidence contract with its specific reason', () => {
    const c = contractValueConcerns({
      value_low_confidence: true,
      value_quality_flag: 'implausible_magnitude',
    })
    expect(c).toHaveLength(1)
    expect(c[0].level).toBe('error')
    expect(c[0].key).toBe('data_quality.concern_implausible_magnitude')
  })

  it('flags a payable discrepancy as a warning even when kept', () => {
    const c = contractValueConcerns({
      value_low_confidence: false,
      value_payable_discrepancy: true,
    })
    expect(c).toHaveLength(1)
    expect(c[0].level).toBe('warning')
  })

  it('can carry both an error and a warning', () => {
    const c = contractValueConcerns({
      value_low_confidence: true,
      value_quality_flag: 'value_disagreement',
      value_payable_discrepancy: true,
    })
    expect(c.map((x) => x.level)).toEqual(['error', 'warning'])
  })
})

describe('DataQualityBadge', () => {
  it('renders nothing when there are no concerns', () => {
    const w = mount(DataQualityBadge, { props: { concerns: [] } })
    expect(w.find('[data-testid="dq-badge"]').exists()).toBe(false)
  })

  it('renders an error glyph when any concern is an error', () => {
    const w = mount(DataQualityBadge, {
      props: { concerns: [{ level: 'error', key: 'k1' }] },
    })
    const badge = w.find('[data-testid="dq-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.classes()).toContain('dq-badge--error')
  })

  it('renders a warning glyph when concerns are only warnings', () => {
    const w = mount(DataQualityBadge, {
      props: { concerns: [{ level: 'warning', key: 'k1' }] },
    })
    expect(w.find('[data-testid="dq-badge"]').classes()).toContain('dq-badge--warning')
  })
})
