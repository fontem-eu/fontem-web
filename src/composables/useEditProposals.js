/**
 * Edit-proposal executor — validates and applies AI-proposed edits.
 *
 * Works against the unified TipTap editor (v2). Each action lands in
 * one of two categories that the parent view uses to decide
 * persistence:
 *
 *   - 'content'  → mutates the local editor; the parent must call
 *                  saveDocument() afterwards or the edit is lost on
 *                  reload.
 *   - 'metadata' → already round-trips through updateReport(); local
 *                  state should mirror the proposal's params.
 *
 * `add_section` / `update_section` were assistant tool actions before
 * v2 reports collapsed into a single document. They are kept here as
 * aliases for `insert_content` so old chat history still applies; the
 * assistant tool no longer advertises them.
 */
import { updateReport } from '../api/community.js'
import { sanitizeHtml } from '../utils/sanitize.js'

const EDIT_ACTIONS = {
  insert_content:  { category: 'content',  requiredParams: ['content'] },
  // Legacy aliases — accepted from old conversations, not advertised
  // by the current assistant tool surface.
  add_section:     { category: 'content',  requiredParams: ['content'], legacy: true },
  update_section:  { category: 'content',  requiredParams: ['content'], legacy: true },
  insert_widget:   { category: 'content',  requiredParams: ['widget_type', 'entityId'] },
  insert_entity_mention: { category: 'content', requiredParams: ['iri', 'label'] },
  update_title:    { category: 'metadata', requiredParams: ['title'] },
  update_abstract: { category: 'metadata', requiredParams: ['abstract'] },
  // The split proposal tools (2026-08). Each verb carries required params
  // only; `replace_body` swaps the WHOLE body in one reviewable card.
  set_title:       { category: 'metadata', requiredParams: ['title'] },
  set_abstract:    { category: 'metadata', requiredParams: ['abstract'] },
  replace_body:    { category: 'content',  requiredParams: ['content'] },
}

export function validateProposal(proposal) {
  if (!proposal || typeof proposal !== 'object') return { valid: false, error: 'Invalid proposal' }
  const spec = EDIT_ACTIONS[proposal.action]
  if (!spec) return { valid: false, error: `Unknown action: ${proposal.action}` }
  for (const param of spec.requiredParams) {
    if (proposal.params?.[param] === undefined && proposal[param] === undefined) {
      return { valid: false, error: `Missing: ${param}` }
    }
  }
  return { valid: true }
}

/**
 * Returns the spec for an action, or null. Exported so the parent
 * view can branch on `category` before calling executeProposal —
 * useful for previewing what an apply will do without running it.
 */
export function actionSpec(action) {
  return EDIT_ACTIONS[action] || null
}

/**
 * The canonical action enum that the assistant tool advertises.
 * Pinned here so a schema-parity test can cross-check it against the
 * Python tool definition.
 */
export const ASSISTANT_ADVERTISED_ACTIONS = [
  'set_title',
  'set_abstract',
  'replace_body',
  'insert_widget',
]

/**
 * Tool name → proposal action, mirroring PROPOSAL_TOOL_ACTIONS in
 * fontem-community-api/src/assistant/doc_tools.py.
 *
 * The panel needs it to match a `tool_result` back to the card its
 * `tool_use` created: the card is drawn before the server has validated
 * the call, so a refusal that arrives later has to find its card.
 */
export const PROPOSAL_TOOL_ACTIONS = {
  mcp__gmr__set_title: 'set_title',
  mcp__gmr__set_abstract: 'set_abstract',
  mcp__gmr__replace_body: 'replace_body',
  mcp__gmr__insert_widget: 'insert_widget',
}

const _IRI_RE = /^http:\/\/data\.fontem\.eu\/id\/([A-Za-z]+)\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function parseClassFromIri(iri) {
  const m = _IRI_RE.exec(String(iri || ''))
  return m ? m[1] : null
}

/**
 * Apply a proposal against the local editor / metadata refs.
 *
 * @param {string} reportId
 * @param {object} proposal - { action, params: {...} }
 * @param {object} editorState - { editor, title, abstract }
 * @returns {{ok: true, action, category, params} | {ok: false, error, action?}}
 */
/* Per-action appliers. One small function per behaviour, dispatched from
 * the same table that validates — the switch this replaces had grown past
 * what a reader (or the complexity gate) could hold at once. */

function _requireEditor(editor, action) {
  return editor ? null : { ok: false, action, error: 'No editor available' }
}

function _cleanHtml(params, action) {
  const clean = sanitizeHtml(params.content)
  if (!clean?.trim()) {
    // Sanitize stripped everything (e.g. content was raw markdown or a
    // script-only payload). Fail loudly so the user sees *why* nothing
    // happened, instead of an Apply that silently applies an empty string.
    return { error: { ok: false, action, error: 'Proposed content was empty after sanitisation' } }
  }
  return { clean }
}

function _applyInsertContent(action, params, editor) {
  const bad = _requireEditor(editor, action)
  if (bad) return bad
  const { clean, error } = _cleanHtml(params, action)
  if (error) return error
  editor.chain().focus().insertContent(clean).run()
  return { ok: true, action, category: 'content', params }
}

function _applyReplaceBody(action, params, editor) {
  const bad = _requireEditor(editor, action)
  if (bad) return bad
  const { clean, error } = _cleanHtml(params, action)
  if (error) return error
  // The whole body, replaced as one unit — setContent, not insert.
  // One card, one review; rejecting it leaves the document untouched.
  editor.chain().focus().setContent(clean).run()
  return { ok: true, action, category: 'content', params }
}

function _applyInsertWidget(action, params, editor) {
  const bad = _requireEditor(editor, action)
  if (bad) return bad
  editor.chain().focus().insertContent({
    type: 'widget',
    attrs: {
      widget_type: params.widget_type,
      schema_version: 1,
      entityId: params.entityId,
      ...(params.depth ? { depth: params.depth } : {}),
    },
  }).run()
  return { ok: true, action, category: 'content', params }
}

function _applyEntityMention(action, params, editor) {
  const bad = _requireEditor(editor, action)
  if (bad) return bad
  const cls = parseClassFromIri(params.iri)
  if (!cls) {
    return { ok: false, action, error: `Invalid IRI: ${params.iri}` }
  }
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'entityMention',
      attrs: { iri: params.iri, label: params.label, class: cls },
    })
    .insertContent(' ')
    .run()
  return { ok: true, action, category: 'content', params }
}

async function _applyMetadata(reportId, action, field, params) {
  await updateReport(reportId, { [field]: params[field] })
  return { ok: true, action, category: 'metadata', params }
}

const _APPLIERS = {
  insert_content: _applyInsertContent,
  add_section: _applyInsertContent,
  update_section: _applyInsertContent,
  replace_body: _applyReplaceBody,
  insert_widget: _applyInsertWidget,
  insert_entity_mention: _applyEntityMention,
}

const _METADATA_FIELDS = {
  set_title: 'title',
  update_title: 'title',
  set_abstract: 'abstract',
  update_abstract: 'abstract',
}

/**
 * Apply a proposal against the local editor / metadata refs.
 *
 * @param {string} reportId
 * @param {object} proposal - { action, params: {...} }
 * @param {object} editorState - { editor, title, abstract }
 * @returns {{ok: true, action, category, params} | {ok: false, error, action?}}
 */
export async function executeProposal(reportId, proposal, editorState) {
  const action = proposal.action
  if (!EDIT_ACTIONS[action]) return { ok: false, action, error: `Unknown action: ${action}` }

  const params = proposal.params || proposal
  const editor = editorState?.editor || editorState?.sections?.[0]?.editor

  try {
    const field = _METADATA_FIELDS[action]
    if (field) return await _applyMetadata(reportId, action, field, params)
    const applier = _APPLIERS[action]
    if (!applier) return { ok: false, action, error: `Unhandled action: ${action}` }
    return applier(action, params, editor)
  } catch (err) {
    return { ok: false, action, error: err.message }
  }
}
