/**
 * What the assistant currently knows about where the user is.
 *
 * The panel used to live inside ReportEditorView and take its context as
 * props. Now it is mounted once in the app shell and is present on every
 * route, so it can no longer be handed editor state by a parent — there
 * is no parent any more.
 *
 * Instead surfaces *register* themselves. The editor publishes its state
 * while it is mounted and withdraws it on unmount, so the assistant sees
 * editor tools only while there is an editor, and the shell does not have
 * to know what an editor is.
 *
 * Module-level refs on purpose: there is exactly one assistant, so this is
 * genuinely singleton state rather than something to provide/inject
 * through a tree the panel is teleported out of anyway.
 */
import { ref, computed } from 'vue'

const reportContext = ref('')
const reportId = ref('')
const editorState = ref({})
/** Set by whoever can act on a proposal (today: the report editor). */
const handlers = ref({ insert: null, applied: null })

/**
 * Register the editing surface. Returns a dispose function; call it on
 * unmount so a stale editor cannot linger in the assistant's context
 * after the user has navigated away.
 */
export function registerEditorContext({ context, id, state, onInsert, onApplied }) {
  reportContext.value = context ?? ''
  reportId.value = id ?? ''
  editorState.value = state ?? {}
  handlers.value = { insert: onInsert ?? null, applied: onApplied ?? null }
  return function dispose() {
    reportContext.value = ''
    reportId.value = ''
    editorState.value = {}
    handlers.value = { insert: null, applied: null }
  }
}

export function useAssistantContext() {
  return {
    reportContext,
    reportId,
    editorState,
    handlers,
    /** True when the assistant can actually write into something. */
    hasEditor: computed(() => Boolean(reportId.value)),
    /**
     * Conversation identity. Report-scoped while editing so the thread
     * stays with the article; one durable global thread otherwise, rather
     * than a new conversation per route — the user is having one
     * conversation, not seventy-five.
     */
    conversationKey: computed(() =>
      reportId.value ? `report:${reportId.value}` : 'global'),
  }
}
