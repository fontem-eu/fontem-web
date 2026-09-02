/**
 * The assistant embedding a Data Studio chart into an article.
 *
 * The gap this closes, from a production session on 2026-08-31: asked to
 * chart EU spending with Israeli companies, the model built the plot in
 * the Studio and then had no verb that could put it in the article. It
 * described the chart in prose instead.
 *
 * What lands in the document is a `pipeline` widget — a recipe, not a
 * picture: sources plus a DuckDB transform that re-run when a reader
 * opens the page. That is the same widget the Studio's own Pocket
 * button produces, and the last test here is the guard that keeps the
 * two roads producing one object.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const ensureProject = vi.fn()
const getPlot = vi.fn()

vi.mock('../../src/api/community.js', () => ({ updateReport: vi.fn().mockResolvedValue({}) }))
vi.mock('../../src/utils/sanitize.js', () => ({ sanitizeHtml: vi.fn((x) => x) }))
vi.mock('../../src/composables/useStudio.js', () => ({
  useStudio: () => ({ ensureProject, getPlot }),
}))

import {
  validateProposal,
  executeProposal,
  actionSpec,
  ASSISTANT_ADVERTISED_ACTIONS,
} from '../../src/composables/useEditProposals.js'
import { specToPipelineConfig } from '../../src/composables/studioPlot.js'

const SPEC = {
  chart: 'bar_h',
  x: 'country',
  y: 'total_eur',
  sources: [{ name: 'spend', lang: 'sql', query: 'select 1' }],
  transform: 'SELECT * FROM spend',
  series: ['a'],
  corrCols: [],
}

/** A TipTap chain stub that records what was inserted. */
function fakeEditor() {
  const inserted = []
  const chain = {
    focus: () => chain,
    insertContent: (node) => { inserted.push(node); return chain },
    setContent: () => chain,
    run: () => true,
  }
  // executeProposal takes { editor } as its third argument, matching
  // editProposals.test.js.
  return { ctx: { editor: { chain: () => chain } }, inserted }
}

beforeEach(() => {
  ensureProject.mockReset().mockResolvedValue({})
  getPlot.mockReset().mockReturnValue({ id: 'plot-1', name: 'Spending', spec: SPEC })
})

describe('specToPipelineConfig', () => {
  it('carries the recipe, never the rows', () => {
    const cfg = specToPipelineConfig(SPEC)
    expect(cfg.data_params.sources[0].query).toBe('select 1')
    expect(cfg.data_params.transform).toBe('SELECT * FROM spend')
    expect(cfg.ui_params.chart).toBe('bar_h')
    expect(cfg.ui_params.x).toBe('country')
    expect(JSON.stringify(cfg)).not.toContain('rows')
  })

  it('copies arrays rather than aliasing the caller’s spec', () => {
    const cfg = specToPipelineConfig(SPEC)
    cfg.ui_params.series.push('mutated')
    cfg.data_params.sources[0].name = 'mutated'
    expect(SPEC.series).toEqual(['a'])
    expect(SPEC.sources[0].name).toBe('spend')
  })

  it('omits events entirely when the plot has none', () => {
    expect(specToPipelineConfig(SPEC).ui_params.events).toBeUndefined()
    expect(specToPipelineConfig({ ...SPEC, events: { source: 's' } }).ui_params.events)
      .toEqual({ source: 's' })
  })
})

describe('the insert_studio_plot proposal', () => {
  it('is advertised and needs both ids', () => {
    expect(ASSISTANT_ADVERTISED_ACTIONS).toContain('insert_studio_plot')
    expect(actionSpec('insert_studio_plot').requiredParams).toEqual(['project_id', 'plot_id'])
    expect(validateProposal({ action: 'insert_studio_plot', params: { project_id: 'p', plot_id: 'q' } }).valid).toBe(true)
    expect(validateProposal({ action: 'insert_studio_plot', params: { project_id: 'p' } }).valid).toBe(false)
  })

  it('inserts a pipeline widget carrying the plot’s recipe', async () => {
    const { ctx, inserted } = fakeEditor()
    const res = await executeProposal('r1', {
      action: 'insert_studio_plot',
      params: { project_id: 'proj', plot_id: 'plot-1' },
    }, ctx)
    expect(res.ok).toBe(true)
    expect(inserted).toHaveLength(1)
    const node = inserted[0]
    expect(node.type).toBe('widget')
    expect(node.attrs.widget_type).toBe('pipeline')
    expect(node.attrs.data_params.transform).toBe('SELECT * FROM spend')
    expect(node.attrs.ui_params.chart).toBe('bar_h')
    // No entityId: a plot is not an entity, and inventing one would make
    // the widget look like something the entity renderers should handle.
    expect(node.attrs.entityId).toBeUndefined()
  })

  it('refuses a plot id that is not in the project, without touching the document', async () => {
    getPlot.mockReturnValue(null)
    const { ctx, inserted } = fakeEditor()
    const res = await executeProposal('r1', {
      action: 'insert_studio_plot', params: { project_id: 'proj', plot_id: 'ghost' },
    }, ctx)
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/not found/i)
    expect(inserted).toHaveLength(0)
  })

  it('refuses a plot with no sources: it could never re-run', async () => {
    getPlot.mockReturnValue({ id: 'p', name: 'empty', spec: { ...SPEC, sources: [] } })
    const { ctx, inserted } = fakeEditor()
    const res = await executeProposal('r1', {
      action: 'insert_studio_plot', params: { project_id: 'proj', plot_id: 'p' },
    }, ctx)
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/no data sources/i)
    expect(inserted).toHaveLength(0)
  })

  it('reports a failed lookup instead of throwing into the panel', async () => {
    ensureProject.mockRejectedValue(new Error('403 Forbidden'))
    const { ctx, inserted } = fakeEditor()
    const res = await executeProposal('r1', {
      action: 'insert_studio_plot', params: { project_id: 'other', plot_id: 'p' },
    }, ctx)
    expect(res.ok).toBe(false)
    expect(res.error).toContain('403 Forbidden')
    expect(inserted).toHaveLength(0)
  })
})

describe('the two roads into an article agree', () => {
  it('the assistant embeds exactly what the Pocket button would', async () => {
    // StudioPlotView.pocket() calls specToPipelineConfig(currentSpec()).
    // The applier calls it on the SAVED spec. Same function, same object —
    // this test is what stops a second hand-rolled mapping appearing.
    const { ctx, inserted } = fakeEditor()
    await executeProposal('r1', {
      action: 'insert_studio_plot', params: { project_id: 'proj', plot_id: 'plot-1' },
    }, ctx)
    const fromPocket = specToPipelineConfig(SPEC)
    expect(inserted[0].attrs.data_params).toEqual(fromPocket.data_params)
    expect(inserted[0].attrs.ui_params).toEqual(fromPocket.ui_params)
  })
})
