import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import VizEmbed from '../../src/widgets/VizEmbed.vue'

const stubs = { ChartSpec: { props: ['chart', 'chartProps'], template: '<div class="chartspec" :data-chart="chart">{{ chartProps.data.length }}</div>' } }

describe('VizEmbed (new viz abstraction)', () => {
  beforeEach(() => { global.fetch = vi.fn() })

  it('fetches the type endpoint and renders plot-ready bars', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({
      title: 'Contracts by number of bidders', chart: 'bar_h', format: 'number',
      bars: [{ label: '1 (single bidder)', value: 22 }, { label: '2', value: 13 }],
    }) })
    const w = mount(VizEmbed, {
      props: { config: { widget_type: 'company_bidder_breakdown', data_params: { entity_id: 'abc' } } },
      global: { stubs, mocks: { $t: (k) => k } },
    })
    await flushPromises()
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/viz/company-bidder-breakdown?entity_id=abc'))
    expect(w.find('.chartspec').attributes('data-chart')).toBe('bar_h')
    expect(w.find('.viz-title').text()).toContain('number of bidders')
  })

  it('shows an error for an unknown viz type and never invents data', async () => {
    const w = mount(VizEmbed, {
      props: { config: { widget_type: 'made_up', data_params: {} } },
      global: { stubs, mocks: { $t: (k) => k } },
    })
    await flushPromises()
    expect(w.find('[data-testid="viz-error"]').exists()).toBe(true)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('saveState returns the recipe (params), not data', () => {
    const w = mount(VizEmbed, {
      props: { config: { widget_type: 'company_bidder_breakdown', data_params: { entity_id: 'x' }, ui_params: { color: 'red' } } },
      global: { stubs, mocks: { $t: (k) => k } },
    })
    expect(w.vm.storeState()).toEqual({ type: 'company_bidder_breakdown', data_params: { entity_id: 'x' }, ui_params: { color: 'red' } })
  })
})
