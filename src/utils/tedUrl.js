/**
 * Build the public TED viewer URL for a contract row.
 *
 * The API returns `ted_url` populated only when the eForms loader was
 * able to extract a URL out of the raw notice payload — which is
 * almost never, because the loader currently doesn't write that field
 * at all. Every contract row therefore arrives with `ted_url: null`,
 * which made the panel render the title as plain text and silently
 * dropped the user's path back to the original filing.
 *
 * Fall back to building the URL from `ted_notice_id` (the eForms
 * publication number) using TED's stable detail viewer route. The
 * route accepts both the legacy OJ format ("YYYY-OJSnnn-nnnnnn") and
 * the new dash-style publication numbers ("nnnnnn-YYYY"), so we don't
 * need to reshape the id.
 *
 * Returns `null` only when no path back to TED exists at all — both
 * the explicit URL and the notice id are missing/blank. Callers should
 * `v-if` on the return value and skip rendering the link in that case.
 */
const TED_DETAIL_BASE = 'https://ted.europa.eu/en/notice/-/detail'

export function tedNoticeUrl(contract) {
  if (!contract) return null
  const explicit = (contract.ted_url || '').trim()
  if (explicit) return explicit
  const noticeId = (contract.ted_notice_id || '').trim()
  if (!noticeId) return null
  return `${TED_DETAIL_BASE}/${encodeURIComponent(noticeId)}`
}
