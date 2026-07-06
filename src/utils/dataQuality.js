/**
 * Map a contract's value-quality signals (from the API) to a list of
 * human-readable data-quality concerns the DataQualityBadge renders.
 *
 * The signals come from the ETL's confidence scorer:
 *   - value_low_confidence: the value was excluded from default totals
 *   - value_quality_flag:   why (value_disagreement / implausible_magnitude / ...)
 *   - value_payable_discrepancy: the source listed a conflicting payable
 *     amount (e.g. the Forca Aerea aircraft: total €7.27M, payable €7.27B)
 *
 * Each concern is { level: 'error' | 'warning', key: <i18n key> }. The
 * helper is generic enough that other data can build its own concerns
 * array for the same badge.
 */
const FLAG_KEY = {
  value_disagreement: 'data_quality.concern_value_disagreement',
  implausible_magnitude: 'data_quality.concern_implausible_magnitude',
  concession_negative: 'data_quality.concern_concession_negative',
  zero_value: 'data_quality.concern_no_value',
  no_awarded_value: 'data_quality.concern_no_value',
  unverified_single_signal: 'data_quality.concern_unverified',
}

export function contractValueConcerns(c) {
  if (!c) return []
  const concerns = []
  if (c.value_low_confidence) {
    concerns.push({
      level: 'error',
      key: FLAG_KEY[c.value_quality_flag] || 'data_quality.concern_low_confidence',
    })
  }
  if (c.value_payable_discrepancy) {
    concerns.push({
      level: 'warning',
      key: 'data_quality.concern_payable_discrepancy',
    })
  }
  return concerns
}


/**
 * Structured "how bad is this datum" descriptor for the clickable
 * DataConfidenceIcon + modal — the value-side sibling of the contract
 * red flags. Three levels:
 *   3 withheld — the platform removed the value (quarantine): the
 *                published number failed hard sanity checks. The claim
 *                survives in the audit log / review queue.
 *   2 low      — the value is shown but weakly evidenced; excluded
 *                from default aggregates.
 *   1 caveat   — value trusted, one signal disagreed (payable).
 * Returns null when there is nothing to say.
 */
const REASON_EXPLANATION_KEY = {
  implausible_magnitude: 'data_quality.explain_implausible_magnitude',
  concession_negative: 'data_quality.explain_concession_negative',
  unverified_single_signal: 'data_quality.explain_unverified',
  zero_value: 'data_quality.explain_zero_value',
  confirmed_bogus: 'data_quality.explain_confirmed_bogus',
}
const REVIEWED_REASONS = new Set([
  'implausible_magnitude', 'concession_negative', 'unverified_single_signal',
])

export function contractValueBadness(c) {
  if (!c) return null
  if (c.value_quarantined) {
    const reason = c.value_quarantine_reason || ''
    let statusKey = 'data_quality.status_auto_withheld'
    if (REVIEWED_REASONS.has(reason)) statusKey = 'data_quality.status_in_review'
    if (reason === 'confirmed_bogus') statusKey = 'data_quality.status_confirmed_bogus'
    return {
      level: 3,
      levelKey: 'data_quality.level_withheld',
      explanationKey:
        REASON_EXPLANATION_KEY[reason] || 'data_quality.explain_withheld_generic',
      reason,
      statusKey,
      confidence: null,
    }
  }
  if (c.value_low_confidence) {
    return {
      level: 2,
      levelKey: 'data_quality.level_low_confidence',
      explanationKey:
        REASON_EXPLANATION_KEY[c.value_quality_flag]
        || 'data_quality.explain_low_confidence_generic',
      reason: c.value_quality_flag || null,
      statusKey: null,
      confidence: typeof c.value_confidence === 'number' ? c.value_confidence : null,
    }
  }
  if (c.value_payable_discrepancy) {
    return {
      level: 1,
      levelKey: 'data_quality.level_caveat',
      explanationKey: 'data_quality.concern_payable_discrepancy',
      reason: 'payable_discrepancy',
      statusKey: null,
      confidence: typeof c.value_confidence === 'number' ? c.value_confidence : null,
    }
  }
  return null
}
