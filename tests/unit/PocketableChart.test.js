import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PocketableChart from '../../src/components/charts/PocketableChart.vue'
import ChartSnapshotEmbed from '../../src/widgets/ChartSnapshotEmbed.vue'
import { resolveWidget } from '../../src/widgets/registry.js'
import { usePocket } from '../../src/composables/usePocket.js'

const KEY = 'contracts_total'

describe('PocketableChart — recipe-only pocket', () => {
  beforeEach(() => {
    localStorage.clear()
    usePocket().clear()
  })

  it('renders the chart with a permanent actions menu button when given a chart-key', () => {
    const w = mount(PocketableChart, {
      props: { chart: 'stat', chartProps: { value: 42, label: 'Answer' }, name: 'Answer', chartKey: KEY },
    })
    expect(w.text()).toContain('42')
    expect(w.find('[data-testid="pocket-menu-btn"]').exists()).toBe(true)
  })

  it('opens the menu with Save + Download actions', async () => {
    const w = mount(PocketableChart, {
      props: { chart: 'stat', chartProps: { value: 1, label: 'X' }, chartKey: KEY },
    })
    await w.find('[data-testid="pocket-menu-btn"]').trigger('click')
    expect(w.find('[data-testid="pocket-save-btn"]').exists()).toBe(true)
    expect(w.find('[data-testid="pocket-download-btn"]').exists()).toBe(true)
  })

  it('hides the actions menu when not savable', () => {
    const w = mount(PocketableChart, { props: { chart: 'stat', chartProps: { value: 1 }, chartKey: KEY, savable: false } })
    expect(w.find('[data-testid="pocket-menu-btn"]').exists()).toBe(false)
  })

  it('hides the menu when there is no chart-key (cannot pocket inline data)', () => {
    const w = mount(PocketableChart, { props: { chart: 'stat', chartProps: { value: 1 } } })
    expect(w.find('[data-testid="pocket-menu-btn"]').exists()).toBe(false)
  })

  it('pockets a dq_chart RECIPE (params), never inline data', async () => {
    const w = mount(PocketableChart, {
      props: { chart: 'bar_h', chartProps: { data: [{ label: 'A', value: 1 }] }, name: 'My Bars',
        chartKey: 'conn_histogram', dataParams: { entity_type: 'Company' } },
    })
    await w.find('[data-testid="pocket-menu-btn"]').trigger('click')
    await w.find('[data-testid="pocket-save-btn"]').trigger('click')
    await w.find('[data-testid="pocket-name-input"]').setValue('My Bars')
    await w.find('[data-testid="pocket-confirm"]').trigger('click')

    const stored = JSON.parse(localStorage.getItem('gmr-pocket'))
    expect(stored).toHaveLength(1)
    expect(stored[0].widget_type).toBe('dq_chart')
    expect(stored[0].config.data_params).toEqual({ chart_key: 'conn_histogram', entity_type: 'Company' })
    expect(stored[0].config.props).toBeUndefined()   // NO inline data
    expect(stored[0].config.chart).toBeUndefined()
  })

  it('download triggers a file download', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL')
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const w = mount(PocketableChart, {
      props: { chart: 'gauge', chartProps: { value: 75, label: 'Coverage' }, name: 'Coverage gauge', chartKey: KEY },
    })
    await w.find('[data-testid="pocket-menu-btn"]').trigger('click')
    await w.find('[data-testid="pocket-download-btn"]').trigger('click')
    expect(createSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    createSpy.mockRestore(); clickSpy.mockRestore()
  })

  it('registry still resolves chart_snapshot (legacy widget)', () => {
    expect(resolveWidget('chart_snapshot')).toBeTruthy()
  })

  it('ChartSnapshotEmbed is INERT — never renders inline data (vector closed)', () => {
    const w = mount(ChartSnapshotEmbed, {
      props: { config: { chart: 'stat', props: { value: 7, label: 'Lucky' }, title: 'Injected' } },
    })
    // the forged inline data must NOT appear
    expect(w.text()).not.toContain('7')
    expect(w.text()).not.toContain('Lucky')
    expect(w.text()).not.toContain('Injected')
    expect(w.text().toLowerCase()).toContain('old inline format')
  })
})
