/**
 * Build the click-through URL for a contract row's TED notice.
 *
 * What we store as `ted_notice_id` is the eForms internal UUID
 * (the `cbc:ID` at the root of the source XML, e.g.
 * `912f1717-1ace-413d-aa61-cd21cd6b95e7`). TED's public detail page
 * is keyed by the *publication-number* TED assigns at publish time
 * (e.g. `295342-2026`) — they're different. Building
 * `https://ted.europa.eu/en/notice/-/detail/<UUID>` directly is what
 * the previous version of this util did, and it returns HTTP 202
 * with an empty body: the JS-rendered TED page can't resolve the
 * notice from its API and gives up silently. User-visible symptom:
 * a blank page.
 *
 * Fix: point at fontem-api's `/contracts/<id>/ted-link` redirector.
 * Backend translates UUID → publication-number via TED's v3 search
 * API and 302s to the canonical detail URL. The browser follows the
 * 302 transparently, so the user lands on the right page in one
 * click (no double-navigation flash).
 *
 * Callers should still `v-if` on the return value and skip rendering
 * the link when both `ted_url` and `ted_notice_id` are missing.
 */

// fontem-api is proxied at /api/ by fontem-web's nginx (see the
// `^~ /api/` location). Same-origin so target="_blank" still works
// cleanly and we don't need CORS.
const REDIRECT_BASE = '/api/contracts'

export function tedNoticeUrl(contract) {
  if (!contract) return null
  // Honor an explicit `ted_url` if the ETL ever fills one in — the
  // backend redirect is the fallback for the common (null) case.
  const explicit = (contract.ted_url || '').trim()
  if (explicit) return explicit
  const noticeId = (contract.ted_notice_id || '').trim()
  if (!noticeId) return null
  return `${REDIRECT_BASE}/${encodeURIComponent(noticeId)}/ted-link`
}
