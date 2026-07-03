import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MultiLineChart from '../../src/components/charts/MultiLineChart.vue'

const twoSeries = [
  { name: 'rape', points: [{ x: 2018, y: 10 }, { x: 2019, y: 12 }, { x: 2020, y: 15 }] },
  { name: 'migration', points: [{ x: 2018, y: 100 }, { x: 2019, y: 90 }, { x: 2020, y: 80 }] },
]

describe('MultiLineChart', () => {
  it('renders a legend + one path per series with distinct colours', () => {
    const w = mount(MultiLineChart, { props: { series: twoSeries, xIsNumeric: true } })
    expect(w.find('[data-testid="mlc-legend"]').exists()).toBe(true)
    expect(w.find('[data-testid="mlc-legend"]').text()).toContain('rape')
    expect(w.find('[data-testid="mlc-legend"]').text()).toContain('migration')
    const paths = w.findAll('path.mlc-line')
    expect(paths.length).toBe(2)
    expect(paths[0].attributes('stroke')).not.toBe(paths[1].attributes('stroke'))
  })

  it('single series has a path but no legend box', () => {
    const w = mount(MultiLineChart, { props: { series: [twoSeries[0]], xIsNumeric: true } })
    expect(w.find('[data-testid="mlc-legend"]').exists()).toBe(false)
    expect(w.findAll('path.mlc-line').length).toBe(1)
  })

  it('empty series shows the empty state', () => {
    const w = mount(MultiLineChart, { props: { series: [] } })
    expect(w.text()).toContain('No series to plot')
  })

  it('hover surfaces a crosshair tooltip with each series value', async () => {
    const w = mount(MultiLineChart, { props: { series: twoSeries, xIsNumeric: true }, attachTo: document.body })
    const svg = w.find('svg.mlc-svg')
    svg.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 760, height: 340 })
    await svg.trigger('mousemove', { clientX: 0, clientY: 100 })
    const tt = w.find('[data-testid="mlc-tooltip"]')
    expect(tt.exists()).toBe(true)
    expect(tt.text()).toContain('rape')
    expect(tt.text()).toContain('migration')
    w.unmount()
  })
})
