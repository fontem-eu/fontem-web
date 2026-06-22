import { describe, it, expect, beforeEach, vi } from 'vitest'
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

  it('renders the chart with a permanent actions menu button (menu closed)', () => {
    const w = mount(PocketableChart, {
      props: { chart: 'stat', chartProps: { value: 42, label: 'Answer' }, name: 'Answer' },
    })
    expect(w.text()).toContain('42')
    expect(w.find('[data-testid="pocket-menu-btn"]').exists()).toBe(true)
    expect(w.find('[data-testid="pocket-menu"]').exists()).toBe(false)
  })

  it('opens the menu with Save + Download actions', async () => {
    const w = mount(PocketableChart, {
      props: { chart: 'stat', chartProps: { value: 1, label: 'X' }, name: 'X' },
    })
    await w.find('[data-testid="pocket-menu-btn"]').trigger('click')
    expect(w.find('[data-testid="pocket-menu"]').exists()).toBe(true)
    expect(w.find('[data-testid="pocket-save-btn"]').exists()).toBe(true)
    expect(w.find('[data-testid="pocket-download-btn"]').exists()).toBe(true)
  })

  it('hides the actions menu when not savable', () => {
    const w = mount(PocketableChart, {
      props: { chart: 'stat', chartProps: { value: 1, label: 'X' }, savable: false },
    })
    expect(w.find('[data-testid="pocket-menu-btn"]').exists()).toBe(false)
  })

  it('saves a chart_snapshot to the pocket with serialised config', async () => {
    const w = mount(PocketableChart, {
      props: {
        chart: 'bar_h',
        chartProps: { data: [{ label: 'A', value: 1 }], format: 'eur', formatValue: () => 'x' },
        name: 'My Bars',
      },
    })
    await w.find('[data-testid="pocket-menu-btn"]').trigger('click')
    await w.find('[data-testid="pocket-save-btn"]').trigger('click')
    await w.find('[data-testid="pocket-name-input"]').setValue('My Bars')
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

  it('download triggers a file download (gauge → svg export)', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL')
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const w = mount(PocketableChart, {
      props: { chart: 'gauge', chartProps: { value: 75, label: 'Coverage' }, name: 'Coverage gauge' },
    })
    await w.find('[data-testid="pocket-menu-btn"]').trigger('click')
    await w.find('[data-testid="pocket-download-btn"]').trigger('click')
    expect(createSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    createSpy.mockRestore()
    clickSpy.mockRestore()
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
