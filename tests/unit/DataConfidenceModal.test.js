/** DataConfidenceModal: explains why a value is distrusted/withheld. */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k) => k }) }))

import DataConfidenceModal from '../../src/components/DataConfidenceModal.vue'
import { contractValueBadness } from '../../src/utils/dataQuality.js'

const contract = { ted_notice_id: 'n-1', title: 'Bus depot' }

describe('DataConfidenceModal', () => {
  it('shows level, explanation and the audit note for withheld values', () => {
    const badness = contractValueBadness({
      value_quarantined: true, value_quarantine_reason: 'implausible_magnitude',
    })
    const w = mount(DataConfidenceModal, {
      props: { visible: true, contract, badness },
      global: { stubs: { Teleport: true } },
    })
    expect(w.find('[data-testid="confidence-level"]').text())
      .toBe('data_quality.level_withheld')
    expect(w.text()).toContain('data_quality.explain_implausible_magnitude')
    expect(w.text()).toContain('data_quality.withheld_audit_note')
  })

  it('renders the confidence score for low-confidence values', () => {
    const badness = contractValueBadness({
      value_low_confidence: true, value_quality_flag: 'value_disagreement',
      value_confidence: 0.31,
    })
    const w = mount(DataConfidenceModal, {
      props: { visible: true, contract, badness },
      global: { stubs: { Teleport: true } },
    })
    expect(w.text()).toContain('31 / 100')
    expect(w.text()).not.toContain('data_quality.withheld_audit_note')
  })

  it('renders nothing when closed', () => {
    const w = mount(DataConfidenceModal, {
      props: { visible: false, contract, badness: null },
      global: { stubs: { Teleport: true } },
    })
    expect(w.find('[data-testid="confidence-backdrop"]').exists()).toBe(false)
  })
})
