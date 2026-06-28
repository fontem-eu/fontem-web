import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DqChartEmbed from '../../src/widgets/DqChartEmbed.vue'
import { DQ_CHARTS } from '../../src/widgets/dqCharts.js'

const stubs = { ChartSpec: { props: ['chart', 'chartProps'], template: '<div class="cs" :data-chart="chart">{{ (chartProps.data||[]).length }}|{{ chartProps.value }}</div>' } }
const mountKey = (chart_key) => mount(DqChartEmbed, {
  props: { config: { data_params: { chart_key } } },
  global: { stubs, mocks: { $t: (k) => k } },
})

describe('DqChartEmbed (DQ chart via recipe)', () => {
  beforeEach(() => { global.fetch = vi.fn() })

  it('refetches the chart_key source and renders the built chart (no inline data)', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ([
      { country: 'ROU', contracts: 217 }, { country: 'POL', contracts: 150 },
    ]) })
    const w = mountKey('contracts_by_country')
    await flushPromises()
    expect(global.fetch).toHaveBeenCalledWith('/api/data-quality/contracts/by-country')
    expect(w.find('.cs').attributes('data-chart')).toBe('bar_h')
    expect(w.find('.cs').text()).toContain('2') // 2 country bars
  })

  it('saveState returns a recipe (chart_key), never data', () => {
    const w = mountKey('contracts_single_bidder_rate')
    expect(w.vm.storeState()).toEqual({ type: 'dq_chart', data_params: { chart_key: 'contracts_single_bidder_rate' }, ui_params: {} })
  })

  it('errors on an unknown chart_key without inventing data', async () => {
    const w = mountKey('made_up_key')
    await flushPromises()
    expect(w.find('[data-testid="viz-error"]').exists()).toBe(true)
    expect(global.fetch).not.toHaveBeenCalled()
  })


  it('every build is null-safe and returns a chart-props object (incl. parameterized)', () => {
    for (const [k, spec] of Object.entries(DQ_CHARTS)) {
      for (const payload of [null, undefined]) {
        const out = spec.build(payload, { entity_type: 'x', graph_iri: 'y' })
        expect(out, k).toBeTypeOf('object')
      }
    }
  })

  it('every registered chart_key has source + chart + build', () => {
    for (const [k, s] of Object.entries(DQ_CHARTS)) {
      expect(s.source, k).toBeTruthy(); expect(s.chart, k).toBeTruthy(); expect(typeof s.build, k).toBe('function')
    }
  })
})
