/**
 * Tests for the edit-proposal validator + executor.
 *
 * Two layers covered here:
 *   1. validateProposal() — schema-shape checks before we let an
 *      Apply button run.
 *   2. executeProposal() — the actual apply, mocking the editor and
 *      community API. This is the layer the bug "Apply does nothing"
 *      lives in, so it gets the most coverage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/community.js', () => ({
  updateReport: vi.fn().mockResolvedValue({}),
}))
vi.mock('../../src/utils/sanitize.js', () => ({
  // Default sanitize: pass-through. Individual tests override when
  // they want to exercise the "sanitiser stripped everything" path.
  sanitizeHtml: vi.fn((x) => x),
}))

import {
  validateProposal,
  executeProposal,
  actionSpec,
  ASSISTANT_ADVERTISED_ACTIONS,
} from '../../src/composables/useEditProposals.js'
import { updateReport } from '../../src/api/community.js'
import { sanitizeHtml } from '../../src/utils/sanitize.js'

// ── Editor stub ───────────────────────────────────────────────────
//
// TipTap's chain API is fluent: editor.chain().focus().insertContent(x).run().
// The stub captures every call so each test can assert on what got
// inserted.
function makeEditor() {
  const calls = []
  const chain = {
    focus: () => chain,
    insertContent: (payload) => { calls.push(payload); return chain },
    run: () => true,
  }
  return { chain: () => chain, calls }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default sanitize back to pass-through (some tests override it).
  sanitizeHtml.mockImplementation((x) => x)
})

// ─── validateProposal ────────────────────────────────────────────

describe('validateProposal', () => {
  it.each([
    ['insert_content',  { content: '<p>hi</p>' }],
    ['insert_widget',   { widget_type: 'graph_explorer', entityId: 'abc' }],
    ['insert_entity_mention', {
      iri: 'http://data.fontem.eu/id/Company/ef69a162-e55c-5d6b-a497-f6436c4e050c',
      label: 'Siemens AG',
    }],
    ['update_title',    { title: 'New' }],
    ['update_abstract', { abstract: 'Summary' }],
    // Legacy aliases — accepted from old conversations.
    ['add_section',     { content: '<p>legacy</p>' }],
    ['update_section',  { content: '<p>legacy</p>' }],
  ])('accepts %s with the right params', (action, params) => {
    expect(validateProposal({ action, params }).valid).toBe(true)
  })

  it('rejects unknown action', () => {
    const r = validateProposal({ action: 'delete_everything', params: {} })
    expect(r.valid).toBe(false)
    expect(r.error).toContain('Unknown action')
  })

  it('rejects missing required param', () => {
    const r = validateProposal({ action: 'insert_content', params: {} })
    expect(r.valid).toBe(false)
    expect(r.error).toContain('Missing')
  })

  it('rejects insert_widget without entityId', () => {
    const r = validateProposal({ action: 'insert_widget', params: { widget_type: 'chart' } })
    expect(r.valid).toBe(false)
  })

  it('rejects null / undefined / non-object proposals', () => {
    expect(validateProposal(null).valid).toBe(false)
    expect(validateProposal(undefined).valid).toBe(false)
    expect(validateProposal('string').valid).toBe(false)
    expect(validateProposal(42).valid).toBe(false)
  })
})

// ─── actionSpec / advertised-action enum ─────────────────────────

describe('action metadata', () => {
  it('marks add_section / update_section as legacy', () => {
    expect(actionSpec('add_section').legacy).toBe(true)
    expect(actionSpec('update_section').legacy).toBe(true)
    expect(actionSpec('insert_content').legacy).toBeUndefined()
  })

  it('exposes the canonical enum the assistant tool advertises', () => {
    // Pinned here so the schema-parity test (separate file) can
    // cross-check it against the Python tool definition. If the
    // assistant gains a new advertised action and this list isn't
    // updated, the parity test fails — which is the point.
    // The split tools (2026-08): each verb has required params only, and
    // replace_body swaps the whole body in one card. The old propose_edit
    // actions stay APPLICABLE (history replays) but are not advertised.
    expect(ASSISTANT_ADVERTISED_ACTIONS).toEqual([
      'set_title',
      'set_abstract',
      'replace_body',
      'insert_widget',
      // The Studio bridge (2026-09): ids only, and the widget it applies
      // is the `pipeline` recipe the Pocket button also produces.
      'insert_studio_plot',
    ])
  })

  it('does NOT advertise legacy aliases', () => {
    expect(ASSISTANT_ADVERTISED_ACTIONS).not.toContain('add_section')
    expect(ASSISTANT_ADVERTISED_ACTIONS).not.toContain('update_section')
  })
})

// ─── executeProposal — happy paths ───────────────────────────────

describe('executeProposal — happy paths', () => {
  it('insert_content sanitises and inserts into the editor', async () => {
    const editor = makeEditor()
    sanitizeHtml.mockReturnValueOnce('<p>clean</p>')

    const result = await executeProposal('r-1', {
      action: 'insert_content',
      params: { content: '<p>raw</p>' },
    }, { editor })

    expect(result).toEqual({
      ok: true,
      action: 'insert_content',
      category: 'content',
      params: { content: '<p>raw</p>' },
    })
    expect(sanitizeHtml).toHaveBeenCalledWith('<p>raw</p>')
    expect(editor.calls).toEqual(['<p>clean</p>'])
    // Content edits do NOT round-trip through updateReport — that's
    // the parent view's job after the editor mutation.
    expect(updateReport).not.toHaveBeenCalled()
  })

  it('insert_widget builds a TipTap widget node with the right attrs', async () => {
    const editor = makeEditor()
    const result = await executeProposal('r-1', {
      action: 'insert_widget',
      params: { widget_type: 'contracts_table', entityId: 'apple-uuid', depth: 2 },
    }, { editor })

    expect(result.ok).toBe(true)
    expect(result.category).toBe('content')
    expect(editor.calls).toEqual([{
      type: 'widget',
      attrs: {
        widget_type: 'contracts_table',
        schema_version: 1,
        entityId: 'apple-uuid',
        depth: 2,
      },
    }])
  })

  it('insert_widget omits depth when not provided', async () => {
    const editor = makeEditor()
    await executeProposal('r-1', {
      action: 'insert_widget',
      params: { widget_type: 'entity_profile', entityId: 'x' },
    }, { editor })
    expect(editor.calls[0].attrs).not.toHaveProperty('depth')
  })

  it('update_title round-trips through updateReport (no editor mutation)', async () => {
    const editor = makeEditor()
    const result = await executeProposal('r-7', {
      action: 'update_title',
      params: { title: 'New title' },
    }, { editor })

    expect(result).toEqual({
      ok: true,
      action: 'update_title',
      category: 'metadata',
      params: { title: 'New title' },
    })
    expect(updateReport).toHaveBeenCalledWith('r-7', { title: 'New title' })
    expect(editor.calls).toEqual([])
  })

  it('update_abstract round-trips through updateReport', async () => {
    const editor = makeEditor()
    const result = await executeProposal('r-7', {
      action: 'update_abstract',
      params: { abstract: 'Brief summary.' },
    }, { editor })

    expect(result.category).toBe('metadata')
    expect(updateReport).toHaveBeenCalledWith('r-7', { abstract: 'Brief summary.' })
    expect(editor.calls).toEqual([])
  })

  it('insert_entity_mention builds a Tiptap mention node + trailing space', async () => {
    const editor = makeEditor()
    const iri = 'http://data.fontem.eu/id/Company/ef69a162-e55c-5d6b-a497-f6436c4e050c'
    const result = await executeProposal('r-1', {
      action: 'insert_entity_mention',
      params: { iri, label: 'Siemens AG' },
    }, { editor })

    expect(result.ok).toBe(true)
    expect(result.category).toBe('content')
    // Two inserts: the mention node, then a trailing space so the
    // cursor lands cleanly past the chip.
    expect(editor.calls).toEqual([
      {
        type: 'entityMention',
        attrs: { iri, label: 'Siemens AG', class: 'Company' },
      },
      ' ',
    ])
  })

  it('insert_entity_mention rejects malformed IRIs', async () => {
    const editor = makeEditor()
    const result = await executeProposal('r-1', {
      action: 'insert_entity_mention',
      params: { iri: 'not-an-iri', label: 'X' },
    }, { editor })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Invalid IRI')
    expect(editor.calls).toEqual([])
  })

  it('legacy add_section maps to content insert (back-compat)', async () => {
    const editor = makeEditor()
    sanitizeHtml.mockReturnValueOnce('<p>section</p>')
    const result = await executeProposal('r-1', {
      action: 'add_section',
      params: { content: '<p>section</p>' },
    }, { editor })

    expect(result.ok).toBe(true)
    expect(result.action).toBe('add_section')
    expect(result.category).toBe('content')
    expect(editor.calls).toEqual(['<p>section</p>'])
  })
})

// ─── executeProposal — failure paths ─────────────────────────────

describe('executeProposal — failure paths', () => {
  it('returns ok:false when the editor is missing for a content edit', async () => {
    const result = await executeProposal('r-1', {
      action: 'insert_content',
      params: { content: '<p>hi</p>' },
    }, { /* no editor */ })

    expect(result).toEqual({
      ok: false,
      action: 'insert_content',
      error: 'No editor available',
    })
  })

  it('returns ok:false when sanitisation strips the entire content', async () => {
    // The "Apply did nothing" bug class: sanitiser drops everything
    // (e.g. raw markdown / script-only payload), then insertContent
    // gets called with empty string. Now we surface the error
    // instead of silently no-op'ing.
    const editor = makeEditor()
    sanitizeHtml.mockReturnValueOnce('   ')

    const result = await executeProposal('r-1', {
      action: 'insert_content',
      params: { content: '<script>bad()</script>' },
    }, { editor })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/empty after sanitisation/i)
    expect(editor.calls).toEqual([])
  })

  it('returns ok:false on unknown action', async () => {
    const result = await executeProposal('r-1', {
      action: 'rm_rf_root',
      params: {},
    }, { editor: makeEditor() })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Unknown action/)
  })

  it('returns ok:false when updateReport throws', async () => {
    updateReport.mockRejectedValueOnce(new Error('500 from API'))
    const result = await executeProposal('r-1', {
      action: 'update_title',
      params: { title: 'x' },
    }, { editor: makeEditor() })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('500 from API')
  })
})

describe('the split proposal actions', () => {
  const makeEditor = () => {
    const calls = []
    const chain = {
      focus: () => chain,
      insertContent: (c) => { calls.push(['insert', c]); return chain },
      setContent: (c) => { calls.push(['set', c]); return chain },
      run: () => {},
    }
    return { chain: () => chain, calls }
  }

  it('replace_body swaps the whole document, not an append', async () => {
    const editor = makeEditor()
    const res = await executeProposal('r1',
      { action: 'replace_body', params: { content: '<p>rewritten</p>' } },
      { editor })
    expect(res.ok).toBe(true)
    expect(res.category).toBe('content')
    expect(editor.calls).toEqual([['set', '<p>rewritten</p>']])
  })

  it('replace_body refuses content that sanitises to nothing', async () => {
    // The sanitizer is mocked pass-through in this file; force the
    // stripped-everything case the guard exists for.
    sanitizeHtml.mockReturnValueOnce('')
    const editor = makeEditor()
    const res = await executeProposal('r1',
      { action: 'replace_body', params: { content: '<script>x()</script>' } },
      { editor })
    expect(res.ok).toBe(false)
    expect(editor.calls).toEqual([])
  })

  it('set_title and set_abstract round-trip through updateReport', async () => {
    // Same path as the update_* actions they supersede.
    const title = await executeProposal('r1',
      { action: 'set_title', params: { title: 'New title' } }, {})
    expect(title.ok).toBe(true)
    expect(title.category).toBe('metadata')
    const abstract = await executeProposal('r1',
      { action: 'set_abstract', params: { abstract: 'New abstract' } }, {})
    expect(abstract.ok).toBe(true)
  })

  it('the legacy actions still validate, for stored conversations', () => {
    expect(validateProposal({ action: 'insert_content', params: { content: 'x' } }).valid).toBe(true)
    expect(validateProposal({ action: 'update_title', params: { title: 'x' } }).valid).toBe(true)
  })
})

// ── Character-addressed editing (2026-09) ─────────────────────────
//
// `replace_part` sends the model's offsets; the SERVER computes the
// revised document and carries it back on the tool result, so what the
// editor applies is a whole document either way. These pin the two
// things that has to get right in the browser: a computed document is
// applied as JSON, and a positioned widget lands where it was asked to.
describe('a server-computed document', () => {
  function makeSetContentEditor() {
    const calls = []
    const chain = {
      focus: () => chain,
      setContent: (c) => { calls.push(['setContent', c]); return chain },
      insertContent: (c) => { calls.push(['insertContent', c]); return chain },
      insertContentAt: (pos, c) => { calls.push(['insertContentAt', pos, c]); return chain },
      run: () => true,
    }
    return { chain: () => chain, calls }
  }

  const DOC = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Revised.' }] },
  ] }

  it('is valid without any HTML content', () => {
    // replace_part carries no `content` at all — the whole point is that
    // the model did not have to restate the article.
    expect(validateProposal({ action: 'replace_body', params: { content_json: DOC } }))
      .toEqual({ valid: true })
  })

  it('still rejects a replace_body carrying neither shape', () => {
    const out = validateProposal({ action: 'replace_body', params: {} })
    expect(out.valid).toBe(false)
    expect(out.error).toMatch(/content or content_json/)
  })

  it('is applied as JSON, not run through the HTML sanitiser', async () => {
    const editor = makeSetContentEditor()
    await executeProposal('r1', { action: 'replace_body', params: { content_json: DOC } }, { editor })
    expect(editor.calls).toEqual([['setContent', DOC]])
  })

  it('wins over HTML when the server sent both', async () => {
    // The computed document is the one spliced against the STORED
    // article, and the only one that carries widgets faithfully.
    const editor = makeSetContentEditor()
    await executeProposal('r1', {
      action: 'replace_body',
      params: { content: '<p>stale</p>', content_json: DOC },
    }, { editor })
    expect(editor.calls).toEqual([['setContent', DOC]])
  })
})

describe('a positioned widget', () => {
  function makePositionedEditor(childSizes) {
    const calls = []
    const chain = {
      focus: () => chain,
      insertContent: (c) => { calls.push(['insertContent', c]); return chain },
      insertContentAt: (pos, c) => { calls.push(['at', pos, c]); return chain },
      run: () => true,
    }
    return {
      chain: () => chain,
      calls,
      state: { doc: {
        childCount: childSizes.length,
        child: (i) => ({ nodeSize: childSizes[i] }),
      } },
    }
  }

  it('lands at the summed size of the blocks before it', async () => {
    const editor = makePositionedEditor([10, 20, 30])
    await executeProposal('r1', {
      action: 'insert_widget',
      params: { widget_type: 'graph_explorer', entityId: 'e1', at_block: 2 },
    }, { editor })
    // ProseMirror positions are document units, not blocks: 10 + 20.
    expect(editor.calls[0][0]).toBe('at')
    expect(editor.calls[0][1]).toBe(30)
  })

  it('appends at the cursor when no position was given', async () => {
    const editor = makePositionedEditor([10, 20])
    await executeProposal('r1', {
      action: 'insert_widget',
      params: { widget_type: 'graph_explorer', entityId: 'e1' },
    }, { editor })
    expect(editor.calls[0][0]).toBe('insertContent')
  })

  it('clamps a position past the end rather than throwing', async () => {
    const editor = makePositionedEditor([10, 20])
    await executeProposal('r1', {
      action: 'insert_widget',
      params: { widget_type: 'graph_explorer', entityId: 'e1', at_block: 99 },
    }, { editor })
    expect(editor.calls[0][1]).toBe(30)
  })

  it('block 0 puts it before everything', async () => {
    const editor = makePositionedEditor([10, 20])
    await executeProposal('r1', {
      action: 'insert_widget',
      params: { widget_type: 'graph_explorer', entityId: 'e1', at_block: 0 },
    }, { editor })
    expect(editor.calls[0][1]).toBe(0)
  })
})
