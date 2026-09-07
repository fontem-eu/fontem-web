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
  // A chart built in Data Studio, embedded as a live recipe. Ids only:
  // the plot is fetched and converted at apply time, so what lands in the
  // document is the plot as it stands when the user accepts the card.
  insert_studio_plot: { category: 'content', requiredParams: ['project_id', 'plot_id'] },
  insert_entity_mention: { category: 'content', requiredParams: ['iri', 'label'] },
  update_title:    { category: 'metadata', requiredParams: ['title'] },
  update_abstract: { category: 'metadata', requiredParams: ['abstract'] },
  // The split proposal tools (2026-08). Each verb carries required params
  // only; `replace_body` swaps the WHOLE body in one reviewable card.
  set_title:       { category: 'metadata', requiredParams: ['title'] },
  set_abstract:    { category: 'metadata', requiredParams: ['abstract'] },
  // Either shape satisfies it. `content` is HTML, which is what the model
  // writes for a whole-body rewrite. `content_json` is a TipTap document
  // the SERVER computed — that is how a `replace_part` arrives, because
  // the splice is done where the stored document is, not in a browser
  // whose buffer may have moved on. JSON rather than HTML because a
  // Studio plot already in the article has data_params/ui_params objects
  // that do not survive an HTML round trip, and editing the prose around
  // a chart must not delete the chart.
  replace_body:    { category: 'content',  requiredParams: [],
                     oneOfParams: ['content', 'content_json'] },
}

export function validateProposal(proposal) {
  if (!proposal || typeof proposal !== 'object') return { valid: false, error: 'Invalid proposal' }
  const spec = EDIT_ACTIONS[proposal.action]
  if (!spec) return { valid: false, error: `Unknown action: ${proposal.action}` }
  const given = (param) =>
    proposal.params?.[param] !== undefined || proposal[param] !== undefined
  for (const param of spec.requiredParams) {
    if (!given(param)) return { valid: false, error: `Missing: ${param}` }
  }
  if (spec.oneOfParams && !spec.oneOfParams.some(given)) {
    return { valid: false, error: `Missing: ${spec.oneOfParams.join(' or ')}` }
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
  'insert_studio_plot',
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
  mcp__gmr__insert_studio_plot: 'insert_studio_plot',
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
  // A server-computed document wins over HTML when both are present: it
  // is the one that was spliced against the stored article, and it is the
  // only one that carries widgets faithfully. It does not go through
  // _cleanHtml — there is no HTML to sanitise, and the content came from
  // our own splice of a document the user already had, not from the model.
  if (params.content_json) {
    editor.chain().focus().setContent(params.content_json).run()
    return { ok: true, action, category: 'content', params }
  }
  const { clean, error } = _cleanHtml(params, action)
  if (error) return error
  // The whole body, replaced as one unit — setContent, not insert.
  // One card, one review; rejecting it leaves the document untouched.
  editor.chain().focus().setContent(clean).run()
  return { ok: true, action, category: 'content', params }
}

/** Collapse whitespace and case, for anchor matching. Mirrors
 * assistant/doc_edit._normalised — an anchor is prose that has been through
 * HTML and TipTap, so runs of spaces and line breaks will not have survived
 * intact, and matching exact bytes would fail on a difference nobody can see.
 */
function _normalised(text) {
  return text.split(/\s+/).filter(Boolean).join(' ').toLowerCase()
}

/**
 * The block index just after the first block containing `afterText`, or
 * null when nothing matches.
 *
 * This arithmetic IS redone here, unlike `at_char`, and for the reason
 * `at_char` is not: the anchor is meant to be resolved against the document
 * as it stands when the user accepts the card. That document exists only
 * here. A model that proposes a body and a chart in one turn cannot cite
 * offsets into the body — its own proposal is still a pending card, so
 * read_document returns the last SAVED text — but it can quote a sentence
 * it just wrote.
 *
 * Matching a phrase is also far more forgiving than reproducing an offset
 * mapping: it either finds the paragraph or it does not.
 */
function _blockAfterAnchor(doc, afterText) {
  if (!afterText || !afterText.trim()) return null
  const needle = _normalised(afterText)
  for (let i = 0; i < doc.childCount; i += 1) {
    // `|| ''`: an atom block (a widget) has no text, and a node view
    // need not expose textContent at all.
    if (_normalised(doc.child(i).textContent || '').includes(needle)) return i + 1
  }
  return null
}

/**
 * Insert a block node after an anchor phrase, at a block INDEX, or at the
 * cursor when there is neither.
 *
 * Order matters. `after_text` wins: it is resolved against the document in
 * front of the user right now. `at_block` is computed server-side from the
 * model's `at_char` against the STORED document — see
 * assistant/doc_edit.block_index_at — and the browser does not redo that
 * arithmetic, because the buffer may have moved since the model measured
 * and two implementations of the same offset mapping drift.
 *
 * An anchor that matches nothing falls through to `at_block`, then to the
 * cursor. A chart in the wrong place is a worse article; a chart that never
 * arrives is a worse bug.
 */
function _insertBlockAt(editor, node, atBlock, afterText) {
  // Optional chaining, not `editor.state.doc`: an editor that exposes no
  // document still has to be able to take an insert. Reading it
  // unconditionally turned "insert at the cursor" into a TypeError.
  const doc = editor.state?.doc
  const anchored = doc ? _blockAfterAnchor(doc, afterText) : null
  const target = anchored === null ? atBlock : anchored
  if (!doc || target === undefined || target === null) {
    editor.chain().focus().insertContent(node).run()
    return
  }
  const index = Math.max(0, Math.min(Number(target), doc.childCount))
  // Sum the sizes of the blocks before it: ProseMirror positions are
  // measured in document units, not blocks.
  let pos = 0
  for (let i = 0; i < index; i += 1) pos += doc.child(i).nodeSize
  editor.chain().focus().insertContentAt(pos, node).run()
}

function _applyInsertWidget(action, params, editor) {
  const bad = _requireEditor(editor, action)
  if (bad) return bad
  _insertBlockAt(editor, {
    type: 'widget',
    attrs: {
      widget_type: params.widget_type,
      schema_version: 1,
      entityId: params.entityId,
      ...(params.depth ? { depth: params.depth } : {}),
    },
  }, params.at_block, params.after_text)
  return { ok: true, action, category: 'content', params }
}

async function _applyInsertStudioPlot(action, params, editor) {
  const bad = _requireEditor(editor, action)
  if (bad) return bad
  // Fetched here rather than carried on the card. The apply runs with the
  // user's own auth, so this is the request that is entitled to the plot;
  // it also means the embed reflects the plot as it stands now, not as it
  // stood when the model proposed it.
  let config
  try {
    const { useStudio } = await import('./useStudio.js')
    const studio = useStudio()
    await studio.ensureProject(params.project_id)
    const plot = studio.getPlot(params.project_id, params.plot_id)
    if (!plot) {
      return { ok: false, action, error: `Plot ${params.plot_id} not found` }
    }
    const { specToPipelineConfig } = await import('./studioPlot.js')
    config = specToPipelineConfig(plot.spec || {})
  } catch (e) {
    return { ok: false, action, error: `Could not load the plot: ${e.message}` }
  }
  if (!config.data_params.sources.length) {
    return { ok: false, action, error: 'That plot has no data sources to re-run' }
  }
  // `pipeline` — the same widget the Studio's Pocket button produces, so
  // the article has one renderer for an embedded chart, not two.
  _insertBlockAt(editor, {
    type: 'widget',
    attrs: {
      widget_type: 'pipeline',
      schema_version: 1,
      data_params: config.data_params,
      ui_params: config.ui_params,
    },
  }, params.at_block, params.after_text)
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
  insert_studio_plot: _applyInsertStudioPlot,
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
