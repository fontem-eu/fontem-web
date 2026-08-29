/**
 * Direct tests for the data-quality descriptor helpers. The component
 * tests (DataQualityBadge / DataConfidenceIcon / DataConfidenceModal)
 * exercise the rendering; these pin the mapping logic itself.
 */
import { describe, it, expect } from 'vitest'
import { contractValueConcerns, contractValueBadness } from '../../src/utils/dataQuality.js'

describe('contractValueConcerns', () => {
  it('returns an empty list for missing input', () => {
    expect(contractValueConcerns(null)).toEqual([])
    expect(contractValueConcerns(undefined)).toEqual([])
  })

  it('returns nothing when no signals are set', () => {
    expect(contractValueConcerns({})).toEqual([])
  })

  it.each([
    ['value_disagreement', 'data_quality.concern_value_disagreement'],
    ['implausible_magnitude', 'data_quality.concern_implausible_magnitude'],
    ['concession_negative', 'data_quality.concern_concession_negative'],
    ['zero_value', 'data_quality.concern_no_value'],
    ['no_awarded_value', 'data_quality.concern_no_value'],
    ['unverified_single_signal', 'data_quality.concern_unverified'],
  ])('maps flag %s to its concern key', (flag, key) => {
    expect(contractValueConcerns({ value_low_confidence: true, value_quality_flag: flag }))
      .toEqual([{ level: 'error', key }])
  })

  it('falls back to the generic low-confidence key for unknown flags', () => {
    expect(contractValueConcerns({ value_low_confidence: true, value_quality_flag: 'novel' }))
      .toEqual([{ level: 'error', key: 'data_quality.concern_low_confidence' }])
  })

  it('adds a payable-discrepancy warning', () => {
    expect(contractValueConcerns({ value_payable_discrepancy: true }))
      .toEqual([{ level: 'warning', key: 'data_quality.concern_payable_discrepancy' }])
  })
})

describe('contractValueBadness — quarantined (level 3)', () => {
  it('returns null for missing input or no signals', () => {
    expect(contractValueBadness(null)).toBeNull()
    expect(contractValueBadness({})).toBeNull()
  })

  it('describes an auto-withheld value with no recorded reason', () => {
    expect(contractValueBadness({ value_quarantined: true })).toEqual({
      level: 3,
      levelKey: 'data_quality.level_withheld',
      explanationKey: 'data_quality.explain_withheld_generic',
      reason: '',
      statusKey: 'data_quality.status_auto_withheld',
      confidence: null,
    })
  })

  it.each([
    ['implausible_magnitude', 'data_quality.explain_implausible_magnitude'],
    ['concession_negative', 'data_quality.explain_concession_negative'],
    ['unverified_single_signal', 'data_quality.explain_unverified'],
  ])('reason %s is in review with its own explanation', (reason, explanationKey) => {
    const out = contractValueBadness({ value_quarantined: true, value_quarantine_reason: reason })
    expect(out.explanationKey).toBe(explanationKey)
    expect(out.statusKey).toBe('data_quality.status_in_review')
  })

  it('zero_value stays auto-withheld (not a reviewed reason)', () => {
    const out = contractValueBadness({ value_quarantined: true, value_quarantine_reason: 'zero_value' })
    expect(out.explanationKey).toBe('data_quality.explain_zero_value')
    expect(out.statusKey).toBe('data_quality.status_auto_withheld')
  })

  it('confirmed_bogus gets its own status', () => {
    const out = contractValueBadness({ value_quarantined: true, value_quarantine_reason: 'confirmed_bogus' })
    expect(out.statusKey).toBe('data_quality.status_confirmed_bogus')
    expect(out.explanationKey).toBe('data_quality.explain_confirmed_bogus')
  })
})

describe('contractValueBadness — low confidence (level 2)', () => {
  it('describes a low-confidence value with a known flag', () => {
    expect(contractValueBadness({
      value_low_confidence: true,
      value_quality_flag: 'implausible_magnitude',
      value_confidence: 0.4,
    })).toEqual({
      level: 2,
      levelKey: 'data_quality.level_low_confidence',
      explanationKey: 'data_quality.explain_implausible_magnitude',
      reason: 'implausible_magnitude',
      statusKey: null,
      confidence: 0.4,
    })
  })

  it('falls back to the generic explanation and null reason', () => {
    const out = contractValueBadness({ value_low_confidence: true })
    expect(out.explanationKey).toBe('data_quality.explain_low_confidence_generic')
    expect(out.reason).toBeNull()
  })

  it('keeps numeric confidence (including 0) and rejects non-numeric', () => {
    expect(contractValueBadness({ value_low_confidence: true, value_confidence: 0 }).confidence).toBe(0)
    expect(contractValueBadness({ value_low_confidence: true, value_confidence: '0.9' }).confidence).toBeNull()
  })

  it('quarantine outranks low confidence', () => {
    expect(contractValueBadness({ value_quarantined: true, value_low_confidence: true }).level).toBe(3)
  })
})

describe('contractValueBadness — payable caveat (level 1)', () => {
  it('describes the payable discrepancy exactly', () => {
    expect(contractValueBadness({ value_payable_discrepancy: true, value_confidence: 0.9 })).toEqual({
      level: 1,
      levelKey: 'data_quality.level_caveat',
      explanationKey: 'data_quality.concern_payable_discrepancy',
      reason: 'payable_discrepancy',
      statusKey: null,
      confidence: 0.9,
    })
  })

  it('low confidence outranks the caveat', () => {
    expect(contractValueBadness({ value_low_confidence: true, value_payable_discrepancy: true }).level).toBe(2)
  })

  it('non-numeric confidence is null on the caveat too', () => {
    expect(contractValueBadness({ value_payable_discrepancy: true, value_confidence: 'x' }).confidence).toBeNull()
  })
})
