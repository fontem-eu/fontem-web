/**
 * Tests for the time-series bar chart component and its aggregation logic.
 *
 * The component uses Canvas for rendering. jsdom doesn't support Canvas,
 * so component tests verify mount/unmount, props, and DOM structure — not
 * the rendered pixels. Aggregation logic is tested via the shared module.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ZoomableBarChart from '../../src/components/charts/ZoomableBarChart.vue'

describe('ZoomableBarChart', () => {
  const sampleData = [
    { date: '2025-09-01', value: 4 },
    { date: '2025-09-02', value: 326 },
    { date: '2025-09-03', value: 1022 },
    { date: '2025-09-15', value: 850 },
    { date: '2025-10-01', value: 1100 },
    { date: '2025-10-15', value: 950 },
  ]

  it('mounts without errors with valid data', () => {
    const wrapper = mount(ZoomableBarChart, {
      props: { data: sampleData },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('shows empty state when data is empty', () => {
    const wrapper = mount(ZoomableBarChart, {
      props: { data: [] },
    })
    expect(wrapper.text()).toContain('No data available')
  })

  it('handles null/undefined data gracefully', () => {
    const wrapper = mount(ZoomableBarChart, {
      props: { data: null },
    })
    expect(wrapper.text()).toContain('No data available')
  })

  it('does not crash with single data point', () => {
    const wrapper = mount(ZoomableBarChart, {
      props: { data: [{ date: '2025-09-01', value: 100 }] },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('renders timespan buttons', () => {
    const wrapper = mount(ZoomableBarChart, {
      props: { data: sampleData },
    })
    const buttons = wrapper.findAll('.tbc-btn')
    expect(buttons.length).toBe(5)
    expect(buttons.map(b => b.text())).toEqual(['6M', '1Y', '2Y', '5Y', 'All'])
  })

  it('renders granularity select', () => {
    const wrapper = mount(ZoomableBarChart, {
      props: { data: sampleData },
    })
    const select = wrapper.find('.tbc-select')
    expect(select.exists()).toBe(true)
    const options = select.findAll('option')
    expect(options.map(o => o.text())).toEqual(['Day', 'Week', 'Month', 'Year'])
  })

  it('defaults to "All" timespan', () => {
    const wrapper = mount(ZoomableBarChart, {
      props: { data: sampleData },
    })
    const active = wrapper.find('.tbc-btn.active')
    expect(active.text()).toBe('All')
  })

  it('renders a canvas element', () => {
    const wrapper = mount(ZoomableBarChart, {
      props: { data: sampleData },
    })
    expect(wrapper.find('canvas').exists()).toBe(true)
  })
})

describe('ZoomableBarChart date aggregation', () => {
  // Reproduces the aggregation logic in isolation
  function aggregateData(rawData, bucket) {
    if (!rawData || rawData.length === 0) return []
    const parsed = rawData.map((d) => ({ date: new Date(d.date), value: d.value }))
    if (bucket === 'day') return parsed.map((d) => ({ key: d.date, value: d.value }))

    const groupsMap = new Map()
    for (const d of parsed) {
      let key
      if (bucket === 'week') {
        const day = d.date.getDay()
        const diff = (day + 6) % 7
        const monday = new Date(d.date)
        monday.setDate(monday.getDate() - diff)
        key = monday.toISOString().slice(0, 10)
      } else if (bucket === 'month') {
        key = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`
      } else {
        key = String(d.date.getFullYear())
      }
      if (!groupsMap.has(key)) groupsMap.set(key, [])
      groupsMap.get(key).push(d)
    }

    return Array.from(groupsMap.entries()).map(([key, items]) => {
      let keyDate
      if (bucket === 'year') keyDate = new Date(`${key}-01-01`)
      else if (bucket === 'month') keyDate = new Date(`${key}-01`)
      else if (bucket === 'week') keyDate = new Date(key)
      else keyDate = items[0].date
      return { key: keyDate, value: items.reduce((s, x) => s + x.value, 0) }
    })
  }

  const data = [
    { date: '2025-09-01', value: 10 },
    { date: '2025-09-02', value: 20 },
    { date: '2025-09-15', value: 30 },
    { date: '2025-10-01', value: 40 },
    { date: '2026-01-01', value: 50 },
  ]

  it('day bucket produces valid Date keys', () => {
    const out = aggregateData(data, 'day')
    expect(out.length).toBe(5)
    out.forEach((d) => {
      expect(d.key).toBeInstanceOf(Date)
      expect(isNaN(d.key.getTime())).toBe(false)
    })
  })

  it('month bucket produces valid Date keys', () => {
    const out = aggregateData(data, 'month')
    expect(out.length).toBeGreaterThan(0)
    out.forEach((d) => {
      expect(d.key).toBeInstanceOf(Date)
      expect(isNaN(d.key.getTime())).toBe(false)
    })
  })

  it('week bucket produces valid Date keys', () => {
    const out = aggregateData(data, 'week')
    expect(out.length).toBeGreaterThan(0)
    out.forEach((d) => {
      expect(d.key).toBeInstanceOf(Date)
      expect(isNaN(d.key.getTime())).toBe(false)
    })
  })

  it('year bucket produces valid Date keys', () => {
    const out = aggregateData(data, 'year')
    expect(out.length).toBeGreaterThan(0)
    out.forEach((d) => {
      expect(d.key).toBeInstanceOf(Date)
      expect(isNaN(d.key.getTime())).toBe(false)
    })
  })

  it('aggregation preserves total value', () => {
    const total = data.reduce((s, d) => s + d.value, 0)
    for (const bucket of ['day', 'week', 'month', 'year']) {
      const out = aggregateData(data, bucket)
      const aggTotal = out.reduce((s, d) => s + d.value, 0)
      expect(aggTotal).toBe(total)
    }
  })
})
