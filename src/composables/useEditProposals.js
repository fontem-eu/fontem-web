/**
 * Edit proposal executor — validates and applies AI-proposed edits.
 *
 * The action schemas are mirrored from gmr-mcp-server/src/edit-actions.js.
 * This is the FRONTEND validation + execution layer.
 */
import { editSection, addSection, updateReport } from '../api/community.js'

/** Action schemas — must match gmr-mcp-server/src/edit-actions.js exactly. */
const EDIT_ACTIONS = {
  add_section: { requiredParams: ['content'] },
  update_section: { requiredParams: ['section_index', 'content'] },
  update_title: { requiredParams: ['title'] },
  update_abstract: { requiredParams: ['abstract'] },
  insert_widget: { requiredParams: ['section_index', 'widget_type', 'entityId'] },
}

/**
 * Validate a proposed edit action.
 * Returns { valid: true } or { valid: false, error: string }.
 */
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
 * Execute a validated proposal against the community API.
 *
 * @param {string} reportId - Current report ID
 * @param {object} proposal - { action, params: {...} }
 * @param {object} editorState - { sections: [{id, editor}], title, abstract }
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function executeProposal(reportId, proposal, editorState) {
  const p = proposal.params || proposal
  const action = proposal.action

  try {
    switch (action) {
      case 'add_section': {
        await addSection(reportId, p.content)
        return { ok: true }
      }
      case 'update_section': {
        const idx = p.section_index === -1 ? editorState.sections.length - 1 : p.section_index
        const sec = editorState.sections[idx]
        if (!sec?.id) return { ok: false, error: `Section ${idx} not found` }
        await editSection(reportId, sec.id, p.content)
        // Also update the Tiptap editor if available
        if (sec.editor) sec.editor.commands.setContent(p.content)
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
        const idx = p.section_index === -1 ? editorState.sections.length - 1 : p.section_index
        const sec = editorState.sections[idx]
        if (!sec?.editor) return { ok: false, error: `Section ${idx} has no editor` }
        const config = {
          widget_type: p.widget_type,
          schema_version: 1,
          entityId: p.entityId,
          ...(p.depth ? { depth: p.depth } : {}),
        }
        const marker = '\n```widget\n' + JSON.stringify(config) + '\n```\n'
        sec.editor.commands.insertContent(marker)
        return { ok: true }
      }
      default:
        return { ok: false, error: `Unknown action: ${action}` }
    }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
