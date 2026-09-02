/**
 * Applying two widget cards must leave TWO widgets in the article.
 *
 * Production, 2026-09-02, in the author's own words: "every time you
 * issue an add plot call it replaces the older plot... the first time
 * you did it, all 4 plots were there". The model proposed several
 * insert_studio_plot cards; applying them left exactly one chart.
 *
 * The cause is ProseMirror selection semantics, so this test drives a
 * REAL Tiptap editor rather than a recording mock — a mock that appends
 * to an array cannot exhibit the bug, and would have reported success
 * the whole time. `widget` is an atom node: inserting one leaves a
 * NodeSelection ON it, and the next `focus()` restores that selection,
 * so `insertContent` REPLACES the node instead of adding after it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { WidgetNode } from '../../src/extensions/WidgetNode.js'

const ensureProject = vi.fn()
const getPlot = vi.fn()
vi.mock('../../src/api/community.js', () => ({ updateReport: vi.fn().mockResolvedValue({}) }))
vi.mock('../../src/utils/sanitize.js', () => ({ sanitizeHtml: vi.fn((x) => x) }))
vi.mock('../../src/composables/useStudio.js', () => ({
  useStudio: () => ({ ensureProject, getPlot }),
}))

import { executeProposal } from '../../src/composables/useEditProposals.js'

const SPEC = {
  chart: 'bar_h', x: 'country', y: 'total_eur',
  sources: [{ name: 's', lang: 'sql', query: 'select 1' }],
  transform: 'SELECT * FROM s', series: [], corrCols: [],
}

function countWidgets(editor) {
  let n = 0
  editor.state.doc.descendants((node) => { if (node.type.name === 'widget') n += 1 })
  return n
}

function makeEditor() {
  return new Editor({
    extensions: [StarterKit, WidgetNode],
    content: '<p>An article about public spending.</p>',
  })
}

beforeEach(() => {
  ensureProject.mockReset().mockResolvedValue({})
  getPlot.mockReset()
})

describe('applying several widget cards', () => {
  it('keeps every studio plot, rather than replacing the last one', async () => {
    const editor = makeEditor()
    for (const id of ['plot-1', 'plot-2', 'plot-3']) {
      getPlot.mockReturnValue({ id, name: id, spec: { ...SPEC, y: id } })
      const res = await executeProposal('r1', {
        action: 'insert_studio_plot',
        params: { project_id: 'proj', plot_id: id },
      }, { editor })
      expect(res.ok).toBe(true)
    }
    expect(countWidgets(editor),
      'three applied cards must leave three charts').toBe(3)
    // And they are distinct — not the same plot three times.
    const ys = []
    editor.state.doc.descendants((n) => {
      if (n.type.name === 'widget') ys.push(n.attrs.ui_params?.y)
    })
    expect(ys).toEqual(['plot-1', 'plot-2', 'plot-3'])
    editor.destroy()
  })

  it('keeps the prose that was already there', async () => {
    const editor = makeEditor()
    getPlot.mockReturnValue({ id: 'p', name: 'p', spec: SPEC })
    await executeProposal('r1', {
      action: 'insert_studio_plot', params: { project_id: 'proj', plot_id: 'p' },
    }, { editor })
    expect(editor.getHTML()).toContain('An article about public spending.')
    editor.destroy()
  })

  it('does the same for entity widgets, which share the insertion path', async () => {
    const editor = makeEditor()
    for (const id of ['e-1', 'e-2']) {
      const res = await executeProposal('r1', {
        action: 'insert_widget',
        params: { widget_type: 'graph_explorer', entityId: id },
      }, { editor })
      expect(res.ok).toBe(true)
    }
    expect(countWidgets(editor), 'two entity widgets must both survive').toBe(2)
    editor.destroy()
  })
})
