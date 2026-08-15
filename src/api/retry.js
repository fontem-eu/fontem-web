/**
 * Retrying the statuses that mean "not now" rather than "no".
 *
 * Three e2e tests failed intermittently on the same shape of event, and
 * none of them said so:
 *
 *   * TRANS-01 — `switchLanguage` awaits getTranslation, and on any throw
 *     leaves the language unchanged. A single failed request left the
 *     English title on screen with the picker showing Portuguese.
 *   * SPARQL-EDITOR — one 429 surfaced as "Query failed: HTTP 429" and the
 *     editor gave up for good.
 *   * FEED-TAG-PERSIST — its seeding helper turned any failure into `null`.
 *
 * 429 is the clearest retry signal HTTP has: the server is not refusing the
 * work, it is asking for it later, usually with `Retry-After` attached. The
 * client retried 5xx and not 429, which is backwards — a 500 may well be
 * permanent, a 429 rarely is.
 *
 * This is not only about tests. Users share addresses — offices, NAT,
 * university networks — so one busy colleague can spend the bucket for
 * everyone, and the person who then loses their translation switch has no
 * idea why.
 */

/**
 * Statuses worth trying again. 408 is a request timeout, 429 a rate limit,
 * 502/504 a gateway that did not get an answer in time.
 *
 * 503 is deliberately NOT here, despite being the textbook transient. This
 * codebase uses it for a permanent condition — fontem-api answers
 * "Virtuoso is not configured in this environment" with a 503 — and a
 * configuration fact does not change between three retries. Retrying it
 * would only make a knowable error take a second and a half to appear.
 */
export const RETRYABLE = new Set([408, 429, 502, 504])

/** How long to wait before attempt N (ms), before Retry-After is consulted. */
export function backoffMs(attempt) {
  // 300, 900, 2700 — quick enough that a page load does not feel stalled,
  // spread enough that three clients retrying do not resynchronise.
  return 300 * 3 ** attempt
}

/**
 * Honour `Retry-After` when the server sent one.
 * Seconds or an HTTP-date, per RFC 9110. Anything unparseable is ignored
 * rather than guessed at, and anything absurd is capped: a server asking
 * for an hour must not hang a page for an hour.
 */
export function retryAfterMs(header, now = Date.now()) {
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.min(seconds * 1000, MAX_WAIT_MS))
  }
  const when = Date.parse(header)
  if (Number.isNaN(when)) return null
  return Math.max(0, Math.min(when - now, MAX_WAIT_MS))
}

export const MAX_WAIT_MS = 5000
export const MAX_ATTEMPTS = 3

/**
 * Run `send()` until it returns a non-retryable response or the attempts
 * run out. `send` must perform one request and resolve to a Response.
 *
 * Returns the last response either way — the caller still decides what a
 * failure means. Nothing here swallows a status.
 */
export async function withRetry(send, {
  attempts = MAX_ATTEMPTS,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  onRetry = null,
} = {}) {
  let res = await send()
  for (let attempt = 0; attempt < attempts - 1; attempt += 1) {
    if (!RETRYABLE.has(res.status)) return res
    const wait = retryAfterMs(res.headers?.get?.('retry-after')) ?? backoffMs(attempt)
    if (onRetry) onRetry({ status: res.status, attempt: attempt + 1, wait })
    await sleep(wait)
    res = await send()
  }
  return res
}
