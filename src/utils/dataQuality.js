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
