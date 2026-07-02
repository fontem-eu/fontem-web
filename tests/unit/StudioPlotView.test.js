import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const push = vi.fn(); const replace = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { projectId: 'P1' } }),
  useRouter: () => ({ push, replace }),
}))
const runTransform = vi.fn()
vi.mock('../../src/composables/useDuckDB.js', () => ({ useDuckDB: () => ({ runTransform, warmup: vi.fn() }) }))

import { useStudio } from '../../src/composables/useStudio.js'
import StudioPlotView from '../../src/views/StudioPlotView.vue'

const stubs = {
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  ChartSpec: { props: ['chart', 'chartProps'], template: '<div class="cs" :data-chart="chart">{{ (chartProps&&chartProps.data||[]).length }}</div>' },
}

function seedProject() {
  localStorage.setItem('fontem-studio', JSON.stringify({ projects: [
    { id: 'P1', name: 'Corruption', createdAt: 't', plots: [], queries: [
      { id: 'Q1', name: 'contracts', lang: 'cypher', query: 'MATCH (c) RETURN c.country AS country, c.v AS value', updatedAt: 't' },
      { id: 'Q2', name: 'migration', lang: 'sql', query: 'SELECT country, value FROM m', updatedAt: 't' },
    ] },
  ] }))
  useStudio().refresh()
}

describe('StudioPlotView (combine + plot + pocket)', () => {
  beforeEach(() => { localStorage.clear(); global.fetch = vi.fn(); runTransform.mockReset(); push.mockReset() })

  it('combines selected queries via DuckDB and plots the result', async () => {
    seedProject()
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['country', 'value'], rows: [['X', 1], ['Y', 2]] }) })
    runTransform.mockResolvedValue({ columns: ['country', 'total'], rows: [['X', 3], ['Y', 7]] })
    const w = mount(StudioPlotView, { global: { stubs } })
    // select both queries
    const toggles = w.findAll('[data-testid="plot-query-toggle"] input')
    await toggles[0].setValue(true); await toggles[1].setValue(true)
    await w.find('[data-testid="plot-combine"]').trigger('click'); await flushPromises()
    expect(global.fetch).toHaveBeenCalledTimes(2) // one per selected query
    expect(runTransform).toHaveBeenCalled()
    expect(w.find('[data-testid="plot-result"] table').text()).toContain('total')
    expect(w.find('[data-testid="studio-plot"]').exists()).toBe(true)
    expect(w.find('.cs').exists()).toBe(true)
  })

  it('pockets the plot as a pipeline recipe (aliased sources + transform, no data)', async () => {
    seedProject()
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['country', 'value'], rows: [['X', 1]] }) })
    runTransform.mockResolvedValue({ columns: ['country', 'total'], rows: [['X', 3]] })
    const w = mount(StudioPlotView, { global: { stubs } })
    await w.findAll('[data-testid="plot-query-toggle"] input')[0].setValue(true)
    await w.find('[data-testid="plot-combine"]').trigger('click'); await flushPromises()
    await w.find('[data-testid="plot-pocket"]').trigger('click'); await flushPromises()
    const pocket = JSON.parse(localStorage.getItem('gmr-pocket') || '[]')
    expect(pocket[0].widget_type).toBe('pipeline')
    expect(pocket[0].config.data_params.sources[0].name).toBe('q1')
    expect(pocket[0].config.data_params.sources[0].query).toContain('MATCH')
    expect(pocket[0].config.props).toBeUndefined()
  })

  it('errors when combining with nothing selected', async () => {
    seedProject()
    const w = mount(StudioPlotView, { global: { stubs } })
    // combine button disabled with no selection
    expect(w.find('[data-testid="plot-combine"]').attributes('disabled')).toBeDefined()
  })
})
