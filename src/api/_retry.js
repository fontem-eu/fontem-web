/**
 * fetch with one seatbelt: a 429 from the platform's own rate limiter
 * (every /api and /capi proxy location sets limit_req_status 429) is
 * retried with a short jittered backoff instead of surfacing as a broken
 * widget. GETs only — a retried write could double-apply.
 *
 * The limiter keys on client IP, so one office behind a NAT — or one
 * e2e runner driving parallel browsers — shares a single token bucket
 * and the marginal request 429s even though nobody is abusing anything.
 * The limiter stays armed; the client absorbs the bounce.
 *
 * While a retry is pending `rateLimited` is true, so the app shell can
 * say so instead of leaving the user staring at a silently empty widget.
 */
import { ref } from 'vue'

export const rateLimited = ref(false)

const MAX_RETRIES = 2

/** Honour Retry-After when the server sends one; otherwise back off a
 *  little longer each attempt, with jitter so parallel callers do not
 *  re-converge on the same instant — the failure mode that drained the
 *  bucket in the first place. */
function retryDelayMs(res, attempt) {
  const after = Number(res.headers?.get?.('retry-after'))
  const base = Number.isFinite(after) && after > 0 ? after * 1000 : 1500
  return base * (attempt + 1) + Math.random() * 500
}

let pending = 0

export async function fetchRetrying(url, init) {
  const method = (init?.method || 'GET').toUpperCase()
  // Same arity as the call site used: an explicit trailing `undefined`
  // is visible to spies and to exotic fetch shims alike.
  const doFetch = () => (init === undefined ? fetch(url) : fetch(url, init))
  let res = await doFetch()
  if (method !== 'GET') return res
  for (let attempt = 0; res.status === 429 && attempt < MAX_RETRIES; attempt++) {
    pending += 1
    rateLimited.value = true
    try {
      await new Promise((r) => setTimeout(r, retryDelayMs(res, attempt)))
      res = await doFetch()
    } finally {
      pending -= 1
      if (pending === 0) rateLimited.value = false
    }
  }
  return res
}
