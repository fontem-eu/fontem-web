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
export async function executeProposal(reportId, proposal, editorState) {
  const action = proposal.action
  const spec = EDIT_ACTIONS[action]
  if (!spec) return { ok: false, action, error: `Unknown action: ${action}` }

  const params = proposal.params || proposal
  const editor = editorState?.editor || editorState?.sections?.[0]?.editor

  try {
    switch (action) {
      case 'insert_content':
      case 'add_section':
      case 'update_section': {
        if (!editor) return { ok: false, action, error: 'No editor available' }
        const clean = sanitizeHtml(params.content)
        if (!clean?.trim()) {
          // Sanitize stripped everything (e.g. content was raw markdown
          // or a script-only payload). Fail loudly so the user sees
          // *why* nothing happened, instead of an Apply that silently
          // appends an empty string.
          return { ok: false, action, error: 'Proposed content was empty after sanitisation' }
        }
        editor.chain().focus().insertContent(clean).run()
        return { ok: true, action, category: 'content', params }
      }
      case 'insert_widget': {
        if (!editor) return { ok: false, action, error: 'No editor available' }
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
      case 'insert_entity_mention': {
        if (!editor) return { ok: false, action, error: 'No editor available' }
        const cls = parseClassFromIri(params.iri)
        if (!cls) {
          return { ok: false, action, error: `Invalid IRI: ${params.iri}` }
        }
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'entityMention',
            attrs: {
              iri: params.iri,
              label: params.label,
              class: cls,
            },
          })
          .insertContent(' ')
          .run()
        return { ok: true, action, category: 'content', params }
      }
      case 'replace_body': {
        if (!editor) return { ok: false, action, error: 'No editor available' }
        const clean = sanitizeHtml(params.content)
        if (!clean?.trim()) {
          return { ok: false, action, error: 'Proposed content was empty after sanitisation' }
        }
        // The whole body, replaced as one unit — setContent, not insert.
        // One card, one review; rejecting it leaves the document untouched.
        editor.chain().focus().setContent(clean).run()
        return { ok: true, action, category: 'content', params }
      }
      case 'set_title':
      case 'update_title': {
        await updateReport(reportId, { title: params.title })
        return { ok: true, action, category: 'metadata', params }
      }
      case 'set_abstract':
      case 'update_abstract': {
        await updateReport(reportId, { abstract: params.abstract })
        return { ok: true, action, category: 'metadata', params }
      }
      default:
        return { ok: false, action, error: `Unhandled action: ${action}` }
    }
  } catch (err) {
    return { ok: false, action, error: err.message }
  }
}
