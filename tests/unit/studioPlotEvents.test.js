import { describe, it, expect } from 'vitest'
import { buildChartProps, extractEvents } from '../../src/composables/studioPlot.js'

const seriesResult = {
  columns: ['year', 'sweden', 'france'],
  rows: [[2018, 60, 20], [2019, 63, 22], [2020, 65, 24]],
}
const eventsInput = {
  name: 'legal_events',
  columns: ['year', 'label', 'detail'],
  rows: [[2024, 'EU: VAW directive adopted', 'Directive (EU) 2024/1385'],
         [2026, 'FRA: VAW law notified', 'National measure, notified 2026-04-27']],
}

describe('line chart event wiring', () => {
  it('attaches events from the named source', () => {
    const props = buildChartProps(seriesResult,
      { chart: 'line', x: 'year', series: ['sweden', 'france'],
        events: { source: 'legal_events', x: 'year', label: 'label', detail: 'detail' } },
      [eventsInput])
    expect(props.series).toHaveLength(2)
    expect(props.events).toEqual([
      { x: 2024, label: 'EU: VAW directive adopted', detail: 'Directive (EU) 2024/1385' },
      { x: 2026, label: 'FRA: VAW law notified', detail: 'National measure, notified 2026-04-27' },
    ])
  })

  it('renders series untouched when the events source is missing', () => {
    const props = buildChartProps(seriesResult,
      { chart: 'line', x: 'year', series: ['sweden'],
        events: { source: 'gone', x: 'year', label: 'label' } }, [])
    expect(props.series).toHaveLength(1)
    expect(props.events).toEqual([])
  })

  it('extractEvents tolerates missing columns', () => {
    expect(extractEvents(
      { events: { source: 'legal_events', x: 'nope', label: 'label' } },
      [eventsInput])).toEqual([])
  })
})
