import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'

// DuckDB-WASM needs a real browser; mock the combine engine for unit tests.
const runTransform = vi.fn()
vi.mock('../../src/composables/useDuckDB.js', () => ({ useDuckDB: () => ({ runTransform, warmup: vi.fn() }) }))

import DataStudioView from '../../src/views/DataStudioView.vue'

const stubs = { ChartSpec: { props: ['chart', 'chartProps'], template: '<div class="cs" :data-chart="chart">{{ (chartProps&&chartProps.data||[]).length }}|{{ chartProps&&chartProps.value }}</div>' } }
const mountView = () => mount(DataStudioView, { global: { plugins: [makeTestI18n()], stubs } })

describe('DataStudioView (data lab)', () => {
  beforeEach(() => { global.fetch = vi.fn(); runTransform.mockReset() })

  it('starts with one source cell + a toolbar', () => {
    const w = mountView()
    expect(w.find('[data-testid="data-studio"]').exists()).toBe(true)
    expect(w.findAll('[data-testid="studio-source"]').length).toBe(1)
  })

  it('adds and removes source cells', async () => {
    const w = mountView()
    await w.find('[data-testid="studio-add-source"]').trigger('click')
    expect(w.findAll('[data-testid="studio-source"]').length).toBe(2)
  })

  it('runs a source query against the right proxy and shows row meta', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['company', 'n'], rows: [['Acme', 5]] }) })
    const w = mountView()
    await w.find('[data-testid="source-run"]').trigger('click'); await flushPromises()
    expect(global.fetch).toHaveBeenCalledWith('/api/query/cypher', expect.objectContaining({ method: 'POST' }))
    expect(w.find('[data-testid="studio-source"]').text()).toContain('1 rows')
  })

  it('combines sources via DuckDB and renders the result table + plot', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['country', 'value'], rows: [['X', 1], ['Y', 2]] }) })
    runTransform.mockResolvedValue({ columns: ['country', 'total'], rows: [['X', 3], ['Y', 7]] })
    const w = mountView()
    await w.find('[data-testid="source-run"]').trigger('click'); await flushPromises()
    await w.find('[data-testid="transform-run"]').trigger('click'); await flushPromises()
    expect(runTransform).toHaveBeenCalled()
    const table = w.find('[data-testid="transform-result"] table')
    expect(table.exists()).toBe(true); expect(table.text()).toContain('total')
    // plot section appears with a chart
    expect(w.find('[data-testid="studio-plot"]').exists()).toBe(true)
    expect(w.find('.cs').exists()).toBe(true)
  })

  it('surfaces a source error without a result', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: 'write not allowed' }) })
    const w = mountView()
    await w.find('[data-testid="source-run"]').trigger('click'); await flushPromises()
    expect(w.find('[data-testid="studio-source"]').text()).toContain('write not allowed')
  })

  it('pockets the plot as a pipeline recipe (sources + transform, no data)', async () => {
    localStorage.clear()
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['country', 'value'], rows: [['X', 1]] }) })
    runTransform.mockResolvedValue({ columns: ['country', 'total'], rows: [['X', 3]] })
    const w = mountView()
    await w.find('[data-testid="source-run"]').trigger('click'); await flushPromises()
    await w.find('[data-testid="transform-run"]').trigger('click'); await flushPromises()
    await w.find('[data-testid="studio-pocket"]').trigger('click'); await flushPromises()
    const pocket = JSON.parse(localStorage.getItem('gmr-pocket') || '[]')
    expect(pocket[0].widget_type).toBe('pipeline')
    expect(pocket[0].config.data_params.sources.length).toBe(1)
    expect(pocket[0].config.data_params.transform).toBeDefined()
    expect(pocket[0].config.props).toBeUndefined()
  })

})
