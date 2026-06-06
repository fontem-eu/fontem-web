/**
 * Build the click-through URL for a contract row's TED notice.
 *
 * Three paths, in priority order:
 *
 *   1. `ted_url` — explicit, ETL-supplied (rare; fontem-api doesn't
 *      currently emit this, but honoured if it ever does).
 *
 *   2. `ted_publication_number` — TED's human-readable identifier
 *      (e.g. `295342-2026`), persisted on the Contract row by the
 *      ETL via TED's v3 search API. When present we link straight to
 *      `https://ted.europa.eu/en/notice/-/detail/<pub-num>` — no
 *      backend round-trip, no 302 latency, fully cacheable, works
 *      from any context (mobile, embeds, third-party).
 *
 *   3. `ted_notice_id` (the eForms UUID) → `/api/contracts/<id>/ted-link`
 *      redirector. The backend translates UUID → publication-number
 *      via TED's v3 search and 302s to the canonical URL. Used for
 *      contracts ingested before the ETL captured the field, or
 *      whose pub-num wasn't yet assigned by TED at ingest time
 *      (queued / not-yet-published). The browser follows the 302
 *      transparently so the user lands on the right page in one
 *      click.
 *
 * Why path #2 matters: hitting `https://ted.europa.eu/en/notice/-/detail/<UUID>`
 * directly returns HTTP 202 with an empty body — TED's JS-rendered
 * page can't resolve the notice from its API and gives up silently.
 * That's why the redirector exists; that's why we prefer the stored
 * pub-num once it's there.
 *
 * Callers should `v-if` on the return value and skip rendering the
 * link when none of the three are present.
 */

// fontem-api is proxied at /api/ by fontem-web's nginx (see the
// `^~ /api/` location). Same-origin so target="_blank" still works
// cleanly and we don't need CORS.
const REDIRECT_BASE = '/api/contracts'
const TED_DETAIL_BASE = 'https://ted.europa.eu/en/notice/-/detail'

export function tedNoticeUrl(contract) {
  if (!contract) return null
  const explicit = (contract.ted_url || '').trim()
  if (explicit) return explicit
  const pubNum = (contract.ted_publication_number || '').trim()
  if (pubNum) return `${TED_DETAIL_BASE}/${encodeURIComponent(pubNum)}`
  const noticeId = (contract.ted_notice_id || '').trim()
  if (!noticeId) return null
  return `${REDIRECT_BASE}/${encodeURIComponent(noticeId)}/ted-link`
}
