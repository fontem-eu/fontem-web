/**
 * Assistant context registry — surfaces register themselves; the panel
 * reads one singleton state.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { registerEditorContext, useAssistantContext } from '../../src/composables/useAssistantContext.js'

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
