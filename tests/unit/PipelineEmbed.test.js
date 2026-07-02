import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
const runTransform = vi.fn()
vi.mock('../../src/composables/useDuckDB.js', () => ({ useDuckDB: () => ({ runTransform, warmup: vi.fn() }) }))
import PipelineEmbed from '../../src/widgets/PipelineEmbed.vue'

const stubs = { StudioMap: { props: ['rows','columns','geoCol','valueCol','level'], template: `<div class="smap" :data-geo="geoCol" :data-level="level"></div>` }, ChartSpec: { props: ['chart', 'chartProps'], template: '<div class="cs" :data-chart="chart">{{ (chartProps&&chartProps.data||[]).length }}</div>' } }
const cfg = { data_params: { sources: [{ name: 'q1', lang: 'cypher', query: 'MATCH (n) RETURN n.country AS country, n.v AS value' }], transform: 'SELECT country, value*2 AS total FROM q1' }, ui_params: { chart: 'bar_h', x: 'country', y: 'total' } }
const mountE = (config = cfg) => mount(PipelineEmbed, { props: { config }, global: { stubs, mocks: { $t: (k) => k } } })

describe('PipelineEmbed (pocketed studio pipeline)', () => {
  beforeEach(() => { global.fetch = vi.fn(); runTransform.mockReset() })

  it('re-runs sources + transform and plots (no inline data)', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['country', 'value'], rows: [['X', 1], ['Y', 2]] }) })
    runTransform.mockResolvedValue({ columns: ['country', 'total'], rows: [['X', 2], ['Y', 4]] })
    const w = mountE(); await flushPromises()
    expect(global.fetch).toHaveBeenCalledWith('/api/query/cypher', expect.objectContaining({ method: 'POST' }))
    expect(runTransform).toHaveBeenCalled()
    expect(w.find('.cs').attributes('data-chart')).toBe('bar_h')
  })

  it('saveState returns the pipeline recipe (params, never data)', () => {
    const w = mountE()
    expect(w.vm.storeState()).toEqual({ type: 'pipeline', data_params: cfg.data_params, ui_params: cfg.ui_params })
  })

  it('shows an error if a source fails', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: 'boom' }) })
    const w = mountE(); await flushPromises()
    expect(w.find('[data-testid="viz-error"]').text()).toContain('boom')
  })

  it('renders a choropleth for an atlas_map pipeline', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['geo', 'val'], rows: [['DE', 1]] }) })
    runTransform.mockResolvedValue({ columns: ['geo', 'val'], rows: [['DE1', 10], ['DEA', 20]] })
    const cfg2 = { data_params: { sources: [{ name: 'q1', lang: 'sql', query: 'SELECT 1' }], transform: 'SELECT * FROM q1' }, ui_params: { chart: 'atlas_map', x: 'geo', y: 'val', level: 1 } }
    const w = mountE(cfg2); await flushPromises()
    const map = w.find('.smap')
    expect(map.exists()).toBe(true)
    expect(map.attributes('data-geo')).toBe('geo')
    expect(map.attributes('data-level')).toBe('1')
  })
})
