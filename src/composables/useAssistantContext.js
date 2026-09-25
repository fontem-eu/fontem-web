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
 * The Data Studio registers the same way (2026-09-25): a project scopes
 * the conversation, and an open query is what the assistant may propose
 * new text for. The query is read through a getter at send time rather
 * than copied at registration, because the editor's draft changes with
 * every keystroke and the assistant must see the text the user is
 * looking at, not the text they had when the page opened.
 *
 * Module-level refs on purpose: there is exactly one assistant, so this is
 * genuinely singleton state rather than something to provide/inject
 * through a tree the panel is teleported out of anyway.
 */
import { ref, shallowRef, computed } from 'vue'

const reportContext = ref('')
const reportId = ref('')
const editorState = ref({})
/** Set by whoever can act on a proposal (today: the report editor). */
const handlers = ref({ insert: null, applied: null })

/**
 * The Studio view on screen: { projectId, projectName, getQuery } or null.
 *
 * Shallow on purpose. A deep ref would hand out a reactive proxy of the
 * registration, and `dispose()` compares by identity to make sure a view
 * unmounting late cannot withdraw the registration that replaced it —
 * a proxy is never `===` the object it wraps, so with a deep ref dispose
 * silently did nothing and the assistant stayed scoped to the project on
 * every later page. Nothing inside the object needs tracking: it changes
 * only by being replaced.
 */
const studioContext = shallowRef(null)
let studioSeq = 0

/** A surface asking the panel to open with a prompt ready to edit. */
const assistRequest = shallowRef(null)
let requestSeq = 0

/** Server-side caps on the studio turn payload (router StudioQueryBody). */
const MAX_TEXT = 8000
const MAX_ERROR = 2000
const MAX_NAME = 300
const MAX_COLUMNS = 50

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

/**
 * Register a Data Studio view. `getQuery` returns the open query as
 * `{ id, name, lang, text, lastError, columns }`, or null when the view
 * holds no query (project page, plot page, a viewer who cannot edit).
 *
 * Dispose only withdraws THIS registration: Studio views replace one
 * another and a view unmounting late must not wipe the registration of
 * the one that replaced it.
 */
export function registerStudioContext({ projectId, projectName, getQuery }) {
  const mine = {
    projectId: String(projectId ?? ''),
    projectName: String(projectName ?? ''),
    getQuery: typeof getQuery === 'function' ? getQuery : () => null,
    seq: ++studioSeq,
  }
  studioContext.value = mine
  return function dispose() {
    if (studioContext.value === mine) studioContext.value = null
  }
}

/**
 * Ask the panel to open with `prompt` in its composer, focused, unsent.
 * Unsent on purpose: the user sees exactly what will be asked and can
 * change it — and an e2e can, too.
 */
export function requestAssist({ prompt }) {
  assistRequest.value = { prompt: String(prompt ?? ''), seq: ++requestSeq }
}

export function clearAssistRequest() {
  assistRequest.value = null
}

/**
 * The `studio` field of a chat turn, or undefined when no Studio view is
 * registered (so the key is simply absent from the JSON body).
 */
export function studioTurnPayload() {
  const s = studioContext.value
  if (!s) return undefined
  let q = null
  try { q = s.getQuery() || null } catch { q = null }
  return {
    project_id: s.projectId,
    project_name: s.projectName.slice(0, MAX_NAME),
    query: q ? {
      id: String(q.id ?? ''),
      name: String(q.name ?? '').slice(0, MAX_NAME),
      lang: String(q.lang ?? 'cypher'),
      text: String(q.text ?? '').slice(0, MAX_TEXT),
      last_error: q.lastError ? String(q.lastError).slice(0, MAX_ERROR) : null,
      columns: Array.isArray(q.columns) ? q.columns.slice(0, MAX_COLUMNS).map(String) : null,
    } : null,
  }
}

export function useAssistantContext() {
  return {
    reportContext,
    reportId,
    editorState,
    handlers,
    studioContext,
    assistRequest,
    clearAssistRequest,
    studioTurnPayload,
    /** True when the assistant can actually write into something. */
    hasEditor: computed(() => Boolean(reportId.value)),
    /**
     * Conversation identity. Report-scoped while editing so the thread
     * stays with the article; project-scoped inside the Data Studio so a
     * project's queries and the talk about them stay together; one durable
     * global thread otherwise, rather than a new conversation per route —
     * the user is having one conversation, not seventy-five.
     */
    conversationKey: computed(() => {
      if (reportId.value) return `report:${reportId.value}`
      if (studioContext.value) return `studio:${studioContext.value.projectId}`
      return 'global'
    }),
  }
}
