import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PocketableChart from '../../src/components/charts/PocketableChart.vue'
import ChartSnapshotEmbed from '../../src/widgets/ChartSnapshotEmbed.vue'
import { resolveWidget } from '../../src/widgets/registry.js'
import { usePocket } from '../../src/composables/usePocket.js'

describe('PocketableChart + chart_snapshot engine', () => {
  beforeEach(() => {
    localStorage.clear()
    usePocket().clear()
  })

  it('renders the underlying chart primitive', () => {
    const w = mount(PocketableChart, {
      props: { chart: 'stat', chartProps: { value: 42, label: 'Answer' }, name: 'Answer' },
    })
    expect(w.text()).toContain('42')
    expect(w.text()).toContain('Answer')
    expect(w.find('[data-testid="pocket-save-btn"]').exists()).toBe(true)
  })

  it('hides the save button when not savable', () => {
    const w = mount(PocketableChart, {
      props: { chart: 'stat', chartProps: { value: 1, label: 'X' }, savable: false },
    })
    expect(w.find('[data-testid="pocket-save-btn"]').exists()).toBe(false)
  })

  it('saves a chart_snapshot to the pocket with serialised config', async () => {
    const w = mount(PocketableChart, {
      props: {
        chart: 'bar_h',
        chartProps: { data: [{ label: 'A', value: 1 }], format: 'eur', formatValue: () => 'x' },
        name: 'My Bars',
      },
    })
    await w.find('[data-testid="pocket-save-btn"]').trigger('click')
    await w.find('[data-testid="pocket-confirm"]').trigger('click')

    const stored = JSON.parse(localStorage.getItem('gmr-pocket'))
    expect(stored).toHaveLength(1)
    expect(stored[0].widget_type).toBe('chart_snapshot')
    expect(stored[0].name).toBe('My Bars')
    expect(stored[0].config.chart).toBe('bar_h')
    expect(stored[0].config.props.data).toEqual([{ label: 'A', value: 1 }])
    expect(stored[0].config.props.format).toBe('eur')
    expect(stored[0].config.props.formatValue).toBeUndefined() // function dropped
  })

  it('registry resolves the chart_snapshot widget type', () => {
    expect(resolveWidget('chart_snapshot')).toBeTruthy()
  })

  it('ChartSnapshotEmbed re-renders a saved snapshot from config', () => {
    const w = mount(ChartSnapshotEmbed, {
      props: { config: { chart: 'stat', props: { value: 7, label: 'Lucky' }, title: 'Title' } },
    })
    expect(w.find('[data-testid="widget-chart-snapshot"]').exists()).toBe(true)
    expect(w.text()).toContain('Title')
    expect(w.text()).toContain('7')
    expect(w.text()).toContain('Lucky')
  })
})
