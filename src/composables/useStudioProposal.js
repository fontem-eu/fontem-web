/**
 * The one query change the assistant has proposed and the user has not yet
 * decided on.
 *
 * A proposal is not an edit. The assistant's `studio_propose_query` tool
 * writes nothing; it hands the panel a complete replacement text, and the
 * text lives HERE — never in the editor's draft — until the user accepts
 * it. The draft autosaves, so putting the proposal into it, even for a
 * preview, would persist a change nobody approved.
 *
 * Two rules the owner set, both enforced by this shape:
 *
 *   - All or nothing. There is one `pending` text, applied whole or dropped
 *     whole. The diff the editor draws from it has no per-hunk controls.
 *   - The assistant is locked while it waits. `locked` is what the panel's
 *     composer reads; it stays true across route changes because the state
 *     is a module singleton, so leaving the query does not lose the lock —
 *     the panel's own notice can still accept or reject it from anywhere.
 *
 * Applying goes through whoever has the query open (the query view registers
 * an applier so the editor text, the autosave and the server stay in step)
 * and falls back to a direct store write when nothing has it open — the
 * user accepted from the chat card on another page, and the change must
 * still land somewhere they can find it.
 */
import { ref, computed } from 'vue'
import { useStudio } from './useStudio.js'

const pending = ref(null)
const error = ref(null)
const busy = ref(false)
let applier = null
let seq = 0

const locked = computed(() => Boolean(pending.value))

/**
 * Register the proposal (the server has validated it by the time this is
 * called). Replaces whatever was pending: the model spoke again, and the
 * older text is no longer what it means. Returns the replaced proposal so
 * the panel can mark that card superseded, or null.
 */
function propose({ projectId, queryId, query, explanation, lang }) {
  const previous = pending.value
  pending.value = {
    projectId: String(projectId ?? ''),
    queryId: String(queryId ?? ''),
    query: String(query ?? ''),
    explanation: String(explanation ?? ''),
    // The store the assistant chose, when it chose one other than the
    // open query's: legislation lives in Virtuoso, contracts in Neo4j,
    // and the user asked in words. Empty means "keep the query's own".
    lang: lang ? String(lang) : '',
    seq: ++seq,
  }
  error.value = null
  return previous
}

/**
 * The surface that can apply a proposal in place. `fn(proposal)` resolves
 * `true` when it applied it (editor text updated AND saved), `false` to
 * decline — typically because it has a different query open — in which
 * case the store is written directly. Returns a dispose function; a
 * disposed applier never shadows a newer one.
 */
function registerApplier(fn) {
  applier = typeof fn === 'function' ? fn : null
  const mine = applier
  return function dispose() {
    if (applier === mine) applier = null
  }
}

/**
 * Apply the pending proposal, whole. Resolves true when it landed. On
 * failure the proposal stays pending — the user has not been able to
 * decide yet, and the lock is the honest state — and `error` says why.
 */
async function accept() {
  const p = pending.value
  if (!p || busy.value) return false
  busy.value = true
  error.value = null
  try {
    let applied = false
    if (applier) applied = (await applier(p)) === true
    if (!applied) {
      await useStudio().updateQuery(p.projectId, p.queryId,
        p.lang ? { query: p.query, lang: p.lang } : { query: p.query })
    }
    if (pending.value === p) pending.value = null
    return true
  } catch (err) {
    error.value = err?.message || String(err)
    return false
  } finally {
    busy.value = false
  }
}

/** Drop the pending proposal. Nothing was written, so nothing to undo. */
function reject() {
  pending.value = null
  error.value = null
}

function isFor(queryId) {
  return pending.value?.queryId === String(queryId ?? '')
}

/** Tests only: the state is module-level. */
function _reset() {
  pending.value = null
  error.value = null
  busy.value = false
  applier = null
}

export function useStudioProposal() {
  return { pending, locked, error, busy, propose, registerApplier, accept, reject, isFor, _reset }
}
