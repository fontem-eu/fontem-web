/**
 * The assistant is part of the shell, not of one page.
 *
 * It used to be mounted inside ReportEditorView, so it existed only while
 * you were editing an article — the one moment you least need help finding
 * your way around. These pin the new arrangement, because "it renders on
 * the page I happened to check" is exactly how it regresses.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { registerEditorContext, useAssistantContext } from '../../src/composables/useAssistantContext.js'

describe('assistant context', () => {
  beforeEach(() => registerEditorContext({})())   // register then dispose == reset

  it('defaults to one durable global conversation, not one per page', () => {
    const { conversationKey, hasEditor } = useAssistantContext()
    expect(conversationKey.value).toBe('global')
    expect(hasEditor.value).toBe(false)
  })

  it('scopes the conversation to the article while editing one', () => {
    const dispose = registerEditorContext({ id: 'abc-123', context: 'ctx' })
    const { conversationKey, hasEditor, reportContext } = useAssistantContext()
    expect(conversationKey.value).toBe('report:abc-123')
    expect(hasEditor.value).toBe(true)
    expect(reportContext.value).toBe('ctx')
    dispose()
  })

  it('withdrawing leaves no stale editor behind', () => {
    const dispose = registerEditorContext({ id: 'abc-123', state: { editor: {} } })
    dispose()
    const { conversationKey, hasEditor, editorState } = useAssistantContext()
    // Without this, the assistant would keep offering to edit an article
    // the user navigated away from, and act on a dead editor instance.
    expect(conversationKey.value).toBe('global')
    expect(hasEditor.value).toBe(false)
    expect(editorState.value).toEqual({})
  })

  it('routes proposals to whichever surface registered a handler', () => {
    const seen = []
    const dispose = registerEditorContext({
      id: 'r1',
      onInsert: (t) => seen.push(['insert', t]),
      onApplied: (p) => seen.push(['applied', p]),
    })
    const { handlers } = useAssistantContext()
    handlers.value.insert('hello')
    handlers.value.applied({ ok: true })
    expect(seen).toEqual([['insert', 'hello'], ['applied', { ok: true }]])
    dispose()
  })
})
