/**
 * Assistant context registry — surfaces register themselves; the panel
 * reads one singleton state.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerEditorContext, registerStudioContext, requestAssist, clearAssistRequest, studioTurnPayload,
  useAssistantContext,
} from '../../src/composables/useAssistantContext.js'

// The module is deliberately singleton state — reset by disposing.
let dispose = null
beforeEach(() => { if (dispose) { dispose(); dispose = null } })

describe('useAssistantContext', () => {
  it('starts with no editor and the global conversation', () => {
    const ctx = useAssistantContext()
    expect(ctx.hasEditor.value).toBe(false)
    expect(ctx.conversationKey.value).toBe('global')
    expect(ctx.reportContext.value).toBe('')
    expect(ctx.editorState.value).toEqual({})
    expect(ctx.handlers.value).toEqual({ insert: null, applied: null })
  })

  it('an editor registration publishes context, id, state and handlers', () => {
    const onInsert = () => {}
    const onApplied = () => {}
    dispose = registerEditorContext({
      context: '# Doc', id: 'r-9', state: { doc: 1 }, onInsert, onApplied,
    })
    const ctx = useAssistantContext()
    expect(ctx.reportContext.value).toBe('# Doc')
    expect(ctx.reportId.value).toBe('r-9')
    expect(ctx.editorState.value).toEqual({ doc: 1 })
    expect(ctx.handlers.value.insert).toBe(onInsert)
    expect(ctx.handlers.value.applied).toBe(onApplied)
    expect(ctx.hasEditor.value).toBe(true)
    expect(ctx.conversationKey.value).toBe('report:r-9')
  })

  it('dispose withdraws everything so no stale editor lingers', () => {
    dispose = registerEditorContext({ context: 'x', id: 'r-1', state: { a: 1 }, onInsert: () => {} })
    dispose(); dispose = null
    const ctx = useAssistantContext()
    expect(ctx.hasEditor.value).toBe(false)
    expect(ctx.conversationKey.value).toBe('global')
    expect(ctx.reportContext.value).toBe('')
    expect(ctx.editorState.value).toEqual({})
    expect(ctx.handlers.value).toEqual({ insert: null, applied: null })
  })

  it('nullish registration fields default to empty', () => {
    dispose = registerEditorContext({})
    const ctx = useAssistantContext()
    expect(ctx.reportContext.value).toBe('')
    expect(ctx.reportId.value).toBe('')
    expect(ctx.hasEditor.value).toBe(false)
  })
})

// ─── Data Studio (2026-09-25) ────────────────────────────────────

describe('useAssistantContext — Data Studio', () => {
  // Studio registrations are withdrawn one by one; a test may leave
  // several behind (that is the point of some of them), so collect them.
  const disposers = []
  const register = (arg) => { const d = registerStudioContext(arg); disposers.push(d); return d }
  beforeEach(() => { while (disposers.length) disposers.pop()(); clearAssistRequest() })

  const QUERY = {
    id: 'q1', name: 'Count', lang: 'sql', text: 'SELECT 1', lastError: 'boom', columns: ['one', 2],
  }

  it('a Studio view scopes the conversation to its project', () => {
    register({ projectId: 'p1', projectName: 'Bids', getQuery: () => null })
    const ctx = useAssistantContext()
    expect(ctx.studioContext.value).toMatchObject({ projectId: 'p1', projectName: 'Bids' })
    expect(ctx.conversationKey.value).toBe('studio:p1')
    // Only the report editor counts as something the assistant can write into.
    expect(ctx.hasEditor.value).toBe(false)
  })

  it('dispose withdraws the registration and returns to the global thread', () => {
    const dispose = register({ projectId: 'p1', projectName: 'Bids', getQuery: () => null })
    dispose()
    const ctx = useAssistantContext()
    expect(ctx.studioContext.value).toBeNull()
    expect(ctx.conversationKey.value).toBe('global')
    expect(studioTurnPayload()).toBeUndefined()
  })

  it('a view unmounting late does not wipe the view that replaced it', () => {
    const disposeOld = register({ projectId: 'p1', projectName: 'Old', getQuery: () => null })
    register({ projectId: 'p2', projectName: 'New', getQuery: () => null })
    disposeOld()
    const ctx = useAssistantContext()
    expect(ctx.conversationKey.value).toBe('studio:p2')
    expect(studioTurnPayload().project_id).toBe('p2')
  })

  it('the report editor wins over the Studio, which wins over global', () => {
    const ctx = useAssistantContext()
    register({ projectId: 'p1', projectName: 'Bids', getQuery: () => null })
    dispose = registerEditorContext({ context: 'x', id: 'r-1', state: {}, onInsert: () => {} })
    expect(ctx.conversationKey.value).toBe('report:r-1')
    dispose(); dispose = null
    expect(ctx.conversationKey.value).toBe('studio:p1')
  })

  it('the turn payload carries the project and the open query in wire shape', () => {
    register({ projectId: 'p1', projectName: 'Bids', getQuery: () => QUERY })
    expect(studioTurnPayload()).toEqual({
      project_id: 'p1',
      project_name: 'Bids',
      query: {
        id: 'q1', name: 'Count', lang: 'sql', text: 'SELECT 1', last_error: 'boom', columns: ['one', '2'],
      },
    })
  })

  it('the turn payload says query: null when the view holds no query', () => {
    register({ projectId: 'p1', projectName: 'Bids', getQuery: () => null })
    expect(studioTurnPayload()).toEqual({ project_id: 'p1', project_name: 'Bids', query: null })
  })

  it('a missing or throwing getQuery is a null query, not a broken turn', () => {
    register({ projectId: 'p1', projectName: 'Bids' })
    expect(studioTurnPayload().query).toBeNull()
    register({ projectId: 'p1', projectName: 'Bids', getQuery: () => { throw new Error('unmounted') } })
    expect(studioTurnPayload().query).toBeNull()
    register({ projectId: 'p1', projectName: 'Bids', getQuery: () => undefined })
    expect(studioTurnPayload().query).toBeNull()
  })

  it('reads the query at send time, so the draft the user is looking at is what is sent', () => {
    const live = { ...QUERY, text: 'SELECT 1' }
    register({ projectId: 'p1', projectName: 'Bids', getQuery: () => live })
    expect(studioTurnPayload().query.text).toBe('SELECT 1')
    live.text = 'SELECT 2'
    live.lastError = null
    expect(studioTurnPayload().query.text).toBe('SELECT 2')
    expect(studioTurnPayload().query.last_error).toBeNull()
  })

  it('optional query fields default the way the server expects them', () => {
    register({ projectId: 'p1', projectName: 'Bids', getQuery: () => ({ id: 'q1' }) })
    expect(studioTurnPayload().query).toEqual({
      id: 'q1', name: '', lang: 'cypher', text: '', last_error: null, columns: null,
    })
    register({ projectId: 'p1', projectName: 'Bids', getQuery: () => ({ id: 7, columns: 'a,b', lastError: '' }) })
    expect(studioTurnPayload().query).toMatchObject({ id: '7', columns: null, last_error: null })
    register({ projectId: 'p1', projectName: 'Bids', getQuery: () => ({ text: 'x' }) })
    expect(studioTurnPayload().query).toMatchObject({ id: '', text: 'x' })
  })

  it('caps the payload at the server limits rather than getting a 422', () => {
    const long = (n) => 'x'.repeat(n)
    register({
      projectId: 'p1',
      projectName: long(301),
      getQuery: () => ({
        id: 'q1', name: long(301), lang: 'cypher', text: long(8001), lastError: long(2001),
        columns: Array.from({ length: 51 }, (_, i) => i),
      }),
    })
    const body = studioTurnPayload()
    expect(body.project_name).toHaveLength(300)
    expect(body.query.name).toHaveLength(300)
    expect(body.query.text).toHaveLength(8000)
    expect(body.query.last_error).toHaveLength(2000)
    expect(body.query.columns).toHaveLength(50)
    expect(body.query.columns[0]).toBe('0')
    expect(body.query.columns[49]).toBe('49')
  })

  it('nullish registration fields become empty strings, not "undefined"', () => {
    register({})
    const ctx = useAssistantContext()
    expect(ctx.conversationKey.value).toBe('studio:')
    expect(studioTurnPayload()).toEqual({ project_id: '', project_name: '', query: null })
  })

  it('requestAssist hands the panel a prompt, and each request is a new event', () => {
    const ctx = useAssistantContext()
    expect(ctx.assistRequest.value).toBeNull()
    requestAssist({ prompt: 'Write a Cypher query' })
    expect(ctx.assistRequest.value.prompt).toBe('Write a Cypher query')
    const first = ctx.assistRequest.value
    // The same prompt asked twice must still open the panel twice: a
    // watcher on the ref sees a new object with a new seq.
    requestAssist({ prompt: 'Write a Cypher query' })
    expect(ctx.assistRequest.value).not.toBe(first)
    expect(ctx.assistRequest.value.seq).toBeGreaterThan(first.seq)
    ctx.clearAssistRequest()
    expect(ctx.assistRequest.value).toBeNull()
  })

  it('a request without a prompt opens the panel with an empty composer', () => {
    requestAssist({})
    expect(useAssistantContext().assistRequest.value.prompt).toBe('')
  })
})
