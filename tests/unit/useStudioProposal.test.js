/**
 * useStudioProposal — the one query change the assistant has proposed and
 * the user has not decided on yet.
 *
 * The store fallback is exercised through the REAL useStudio store against
 * the in-memory API mock (same wiring as useStudio.test.js), so "accepted
 * from another page" lands where the rest of the app will read it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
vi.mock('../../src/api/studio.js', async () => (await import('./helpers/studioApiMock.js')).makeStudioApiMock())

import * as api from '../../src/api/studio.js'
import { useStudio } from '../../src/composables/useStudio.js'
import { useStudioProposal } from '../../src/composables/useStudioProposal.js'

const PROJECT = {
  id: 'p1', name: 'Bids', created_by: 'u', plots: [],
  queries: [{ id: 'q1', project_id: 'p1', name: 'Count', lang: 'cypher', query: 'MATCH (c:Company) RETURN c LIMIT 5' }],
}
const PROPOSED = 'MATCH (c:Company) RETURN count(c) AS companies'
const proposalFor = (over = {}) => ({
  projectId: 'p1', queryId: 'q1', query: PROPOSED, explanation: 'A count instead of rows.', ...over,
})

/** A promise the test resolves by hand, to observe the in-flight state. */
function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('useStudioProposal', () => {
  let store, sp
  beforeEach(async () => {
    // __reset clears the data, not the spies' call counts.
    vi.clearAllMocks()
    api.__reset()
    api.__seed([PROJECT])
    store = useStudio()
    store.reset()
    await store.ensureLoaded()
    sp = useStudioProposal()
    sp._reset()
  })

  it('starts with nothing pending and the assistant unlocked', () => {
    expect(sp.pending.value).toBeNull()
    expect(sp.locked.value).toBe(false)
    expect(sp.error.value).toBeNull()
    expect(sp.busy.value).toBe(false)
    expect(sp.isFor('q1')).toBe(false)
  })

  it('propose parks the text outside the draft and locks the assistant', () => {
    const replaced = sp.propose(proposalFor())
    expect(replaced).toBeNull()
    expect(sp.pending.value).toMatchObject({
      projectId: 'p1', queryId: 'q1', query: PROPOSED, explanation: 'A count instead of rows.',
    })
    expect(sp.locked.value).toBe(true)
    // Nothing was written: the store still holds the user's own text.
    expect(store.getQuery('p1', 'q1').query).toBe(PROJECT.queries[0].query)
    expect(api.updateQuery).not.toHaveBeenCalled()
  })

  it('a second proposal replaces the first and hands it back for the superseded card', () => {
    sp.propose(proposalFor({ query: 'RETURN 1' }))
    const first = sp.pending.value
    const replaced = sp.propose(proposalFor({ query: 'RETURN 2' }))
    expect(replaced).toBe(first)
    expect(sp.pending.value.query).toBe('RETURN 2')
    // Each proposal is a distinct event, even with identical text — the
    // panel keys cards on it.
    const again = sp.propose(proposalFor({ query: 'RETURN 2' }))
    expect(again).not.toBe(sp.pending.value)
    expect(sp.pending.value.seq).toBeGreaterThan(again.seq)
    expect(again.seq).toBeGreaterThan(first.seq)
  })

  it('coerces nullish fields to empty strings so the panel never sees undefined', () => {
    sp.propose({ projectId: null, queryId: undefined, query: null, explanation: undefined })
    expect(sp.pending.value).toMatchObject({ projectId: '', queryId: '', query: '', explanation: '' })
    expect(sp.locked.value).toBe(true)
  })

  it('isFor answers for the pending query only, whatever type the id arrives as', () => {
    sp.propose(proposalFor({ queryId: 42 }))
    expect(sp.isFor(42)).toBe(true)
    expect(sp.isFor('42')).toBe(true)
    expect(sp.isFor('q1')).toBe(false)
    expect(sp.isFor(null)).toBe(false)
    sp.reject()
    expect(sp.isFor(42)).toBe(false)
  })

  it('accept goes through the registered applier and never falls back to the store', async () => {
    const applier = vi.fn(async () => true)
    sp.registerApplier(applier)
    sp.propose(proposalFor())
    const p = sp.pending.value
    await expect(sp.accept()).resolves.toBe(true)
    expect(applier).toHaveBeenCalledTimes(1)
    expect(applier).toHaveBeenCalledWith(p)
    expect(api.updateQuery).not.toHaveBeenCalled()
    expect(sp.pending.value).toBeNull()
    expect(sp.locked.value).toBe(false)
    expect(sp.error.value).toBeNull()
    expect(sp.busy.value).toBe(false)
  })

  it('accept falls back to the store when the applier declines', async () => {
    const applier = vi.fn(async () => false)
    sp.registerApplier(applier)
    sp.propose(proposalFor())
    await expect(sp.accept()).resolves.toBe(true)
    expect(applier).toHaveBeenCalledTimes(1)
    expect(api.updateQuery).toHaveBeenCalledTimes(1)
    expect(api.updateQuery).toHaveBeenCalledWith('p1', 'q1', { query: PROPOSED })
    // The real store cache now carries the accepted text, so a later
    // visit to the query shows what was accepted.
    expect(store.getQuery('p1', 'q1').query).toBe(PROPOSED)
    expect(sp.pending.value).toBeNull()
    expect(sp.locked.value).toBe(false)
  })

  it('an applier that resolves anything but true counts as declining', async () => {
    // A surface that forgot to return, or returned a truthy receipt, must
    // not swallow the change silently: the store write still happens.
    sp.registerApplier(async () => undefined)
    sp.propose(proposalFor())
    await expect(sp.accept()).resolves.toBe(true)
    expect(api.updateQuery).toHaveBeenCalledTimes(1)
    sp.registerApplier(async () => 'ok')
    sp.propose(proposalFor({ query: 'RETURN 2' }))
    await expect(sp.accept()).resolves.toBe(true)
    expect(api.updateQuery).toHaveBeenCalledTimes(2)
    expect(api.updateQuery).toHaveBeenLastCalledWith('p1', 'q1', { query: 'RETURN 2' })
  })

  it('accept writes the store directly when nothing has the query open', async () => {
    sp.propose(proposalFor())
    await expect(sp.accept()).resolves.toBe(true)
    expect(api.updateQuery).toHaveBeenCalledWith('p1', 'q1', { query: PROPOSED })
    expect(store.getQuery('p1', 'q1').query).toBe(PROPOSED)
    expect(sp.pending.value).toBeNull()
  })

  it('accept with nothing pending is a no-op that resolves false', async () => {
    await expect(sp.accept()).resolves.toBe(false)
    expect(api.updateQuery).not.toHaveBeenCalled()
    expect(sp.busy.value).toBe(false)
  })

  it('a failed store write keeps the proposal pending, locked, and says why', async () => {
    api.updateQuery.mockRejectedValueOnce(new Error('409 conflict'))
    sp.propose(proposalFor())
    const p = sp.pending.value
    await expect(sp.accept()).resolves.toBe(false)
    expect(sp.pending.value).toBe(p)
    expect(sp.locked.value).toBe(true)
    expect(sp.error.value).toBe('409 conflict')
    expect(sp.busy.value).toBe(false)
    // The user has not been able to decide; retrying works once the server does.
    await expect(sp.accept()).resolves.toBe(true)
    expect(sp.pending.value).toBeNull()
    expect(sp.error.value).toBeNull()
  })

  it('a throwing applier is a failure too, and does not fall through to the store', async () => {
    sp.registerApplier(async () => { throw new Error('editor gone') })
    sp.propose(proposalFor())
    await expect(sp.accept()).resolves.toBe(false)
    expect(api.updateQuery).not.toHaveBeenCalled()
    expect(sp.pending.value).not.toBeNull()
    expect(sp.error.value).toBe('editor gone')
  })

  it('a non-Error rejection still yields a readable error message', async () => {
    api.updateQuery.mockRejectedValueOnce('network down')
    sp.propose(proposalFor())
    await expect(sp.accept()).resolves.toBe(false)
    expect(sp.error.value).toBe('network down')
  })

  it('reports busy while the applier is in flight and refuses a second accept meanwhile', async () => {
    const gate = deferred()
    const applier = vi.fn(() => gate.promise)
    sp.registerApplier(applier)
    sp.propose(proposalFor())
    const first = sp.accept()
    expect(sp.busy.value).toBe(true)
    await expect(sp.accept()).resolves.toBe(false)
    expect(applier).toHaveBeenCalledTimes(1)
    gate.resolve(true)
    await expect(first).resolves.toBe(true)
    expect(sp.busy.value).toBe(false)
    expect(api.updateQuery).not.toHaveBeenCalled()
  })

  it('a proposal that arrives while an older one is being applied survives the older accept', async () => {
    const gate = deferred()
    sp.registerApplier(() => gate.promise)
    sp.propose(proposalFor({ query: 'RETURN 1' }))
    const first = sp.accept()
    // The model spoke again before the first landed: the newer text is
    // what the user must still decide on.
    sp.propose(proposalFor({ query: 'RETURN 2' }))
    gate.resolve(true)
    await expect(first).resolves.toBe(true)
    expect(sp.pending.value?.query).toBe('RETURN 2')
    expect(sp.locked.value).toBe(true)
  })

  it('reject drops the proposal and its error without writing anything', async () => {
    api.updateQuery.mockRejectedValueOnce(new Error('boom'))
    sp.propose(proposalFor())
    await sp.accept()
    expect(sp.error.value).toBe('boom')
    sp.reject()
    expect(sp.pending.value).toBeNull()
    expect(sp.locked.value).toBe(false)
    expect(sp.error.value).toBeNull()
    expect(api.updateQuery).toHaveBeenCalledTimes(1) // only the failed attempt
    expect(store.getQuery('p1', 'q1').query).toBe(PROJECT.queries[0].query)
  })

  it('a new proposal clears the error left by a failed accept', async () => {
    api.updateQuery.mockRejectedValueOnce(new Error('boom'))
    sp.propose(proposalFor())
    await sp.accept()
    expect(sp.error.value).toBe('boom')
    sp.propose(proposalFor({ query: 'RETURN 2' }))
    expect(sp.error.value).toBeNull()
  })

  it('a disposed applier is no longer consulted', async () => {
    const applier = vi.fn(async () => true)
    const dispose = sp.registerApplier(applier)
    dispose()
    sp.propose(proposalFor())
    await expect(sp.accept()).resolves.toBe(true)
    expect(applier).not.toHaveBeenCalled()
    expect(api.updateQuery).toHaveBeenCalledTimes(1)
  })

  it('disposing an older applier does not unregister the one that replaced it', async () => {
    // Views replace one another; the old one unmounts late.
    const older = vi.fn(async () => true)
    const newer = vi.fn(async () => true)
    const disposeOlder = sp.registerApplier(older)
    sp.registerApplier(newer)
    disposeOlder()
    sp.propose(proposalFor())
    await expect(sp.accept()).resolves.toBe(true)
    expect(newer).toHaveBeenCalledTimes(1)
    expect(older).not.toHaveBeenCalled()
    expect(api.updateQuery).not.toHaveBeenCalled()
  })

  it('registering a non-function clears the applier so the store fallback applies', async () => {
    sp.registerApplier(async () => true)
    sp.registerApplier(null)
    sp.propose(proposalFor())
    await expect(sp.accept()).resolves.toBe(true)
    expect(api.updateQuery).toHaveBeenCalledTimes(1)
    // A truthy non-function (a view handing over the wrong thing) must not
    // be called either: the change still lands, via the store.
    sp.registerApplier({ apply: async () => true })
    sp.propose(proposalFor({ query: 'RETURN 2' }))
    await expect(sp.accept()).resolves.toBe(true)
    expect(sp.error.value).toBeNull()
    expect(api.updateQuery).toHaveBeenCalledTimes(2)
  })

  it('a bare rejection (no reason) still resolves false instead of throwing into the click handler', async () => {
    api.updateQuery.mockRejectedValueOnce(undefined)
    sp.propose(proposalFor())
    await expect(sp.accept()).resolves.toBe(false)
    expect(sp.pending.value).not.toBeNull()
    expect(typeof sp.error.value).toBe('string')
  })

  it('a fresh module starts idle, so the first accept in the app is not refused', async () => {
    // Every other test calls _reset(); the app never does. The initial
    // state must be usable on its own.
    vi.resetModules()
    const fresh = (await import('../../src/composables/useStudioProposal.js')).useStudioProposal()
    expect(fresh.busy.value).toBe(false)
    expect(fresh.locked.value).toBe(false)
    expect(fresh.pending.value).toBeNull()
    fresh.registerApplier(async () => true)
    fresh.propose(proposalFor())
    await expect(fresh.accept()).resolves.toBe(true)
  })
})
