/**
 * DataConfidenceIcon + contractValueBadness: the value-side sibling of
 * the contract red flags — levels of data badness with explanations.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k) => k }) }))

import DataConfidenceIcon from '../../src/components/DataConfidenceIcon.vue'
import { contractValueBadness } from '../../src/utils/dataQuality.js'

describe('contractValueBadness', () => {
  it('level 3 (withheld) for quarantined values, with review status', () => {
    const b = contractValueBadness({
      value_quarantined: true,
      value_quarantine_reason: 'implausible_magnitude',
    })
    expect(b.level).toBe(3)
    expect(b.explanationKey).toBe('data_quality.explain_implausible_magnitude')
    expect(b.statusKey).toBe('data_quality.status_in_review')
  })

  it('zero_value quarantine is auto-withheld, not review-queued', () => {
    const b = contractValueBadness({
      value_quarantined: true,
      value_quarantine_reason: 'zero_value',
    })
    expect(b.level).toBe(3)
    expect(b.statusKey).toBe('data_quality.status_auto_withheld')
  })

  it('level 2 (low confidence) keeps the confidence score', () => {
    const b = contractValueBadness({
      value_low_confidence: true,
      value_quality_flag: 'implausible_magnitude',
      value_confidence: 0.42,
    })
    expect(b.level).toBe(2)
    expect(b.confidence).toBe(0.42)
  })

  it('level 1 (caveat) for a payable discrepancy alone', () => {
    const b = contractValueBadness({ value_payable_discrepancy: true })
    expect(b.level).toBe(1)
  })

  it('null when there is nothing to say', () => {
    expect(contractValueBadness({ value_eur: 5e6 })).toBeNull()
    expect(contractValueBadness(null)).toBeNull()
  })
})

describe('DataConfidenceIcon', () => {
  const badness = contractValueBadness({
    value_quarantined: true,
    value_quarantine_reason: 'implausible_magnitude',
  })

  it('renders the barred-circle glyph for withheld values', () => {
    const w = mount(DataConfidenceIcon, { props: { badness } })
    expect(w.find('[data-testid="data-confidence-icon"]').exists()).toBe(true)
    expect(w.classes().some((c) => c === 'dc-icon--l3')).toBe(true)
  })

  it('emits click when pressed', async () => {
    const w = mount(DataConfidenceIcon, { props: { badness } })
    await w.find('[data-testid="data-confidence-icon"]').trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })
})
