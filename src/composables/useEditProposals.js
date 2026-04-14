/**
 * Edit proposal executor — validates and applies AI-proposed edits.
 *
 * Works with the unified TipTap editor (v2). The assistant can:
 * - insert_content: append HTML/text at the end of the document
 * - update_title: change the report title
 * - update_abstract: change the report abstract
 * - insert_widget: insert a widget node at the cursor
 */
import { updateReport } from '../api/community.js'
import { sanitizeHtml } from '../utils/sanitize.js'

const EDIT_ACTIONS = {
  add_section: { requiredParams: ['content'] },
  insert_content: { requiredParams: ['content'] },
  update_section: { requiredParams: ['content'] },
  update_title: { requiredParams: ['title'] },
  update_abstract: { requiredParams: ['abstract'] },
  insert_widget: { requiredParams: ['widget_type', 'entityId'] },
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
 * Execute a proposal against the unified editor.
 *
 * @param {string} reportId
 * @param {object} proposal - { action, params: {...} }
 * @param {object} editorState - { editor, title, abstract }
 */
export async function executeProposal(reportId, proposal, editorState) {
  const p = proposal.params || proposal
  const action = proposal.action
  const editor = editorState.editor || editorState.sections?.[0]?.editor

  try {
    switch (action) {
      case 'add_section':
      case 'insert_content':
      case 'update_section': {
        // All content insertions go to the unified editor
        if (!editor) return { ok: false, error: 'No editor available' }
        const clean = sanitizeHtml(p.content)
        editor.chain().focus().insertContent(clean).run()
        return { ok: true }
      }
      case 'update_title': {
        await updateReport(reportId, { title: p.title })
        return { ok: true }
      }
      case 'update_abstract': {
        await updateReport(reportId, { abstract: p.abstract })
        return { ok: true }
      }
      case 'insert_widget': {
        if (!editor) return { ok: false, error: 'No editor available' }
        editor.chain().focus().insertContent({
          type: 'widget',
          attrs: {
            widget_type: p.widget_type,
            schema_version: 1,
            entityId: p.entityId,
            ...(p.depth ? { depth: p.depth } : {}),
          },
        }).run()
        return { ok: true }
      }
      default:
        return { ok: false, error: `Unknown action: ${action}` }
    }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
