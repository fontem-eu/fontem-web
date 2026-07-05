import { describe, it, expect } from 'vitest'
import { buildChartProps } from '../../src/composables/studioPlot.js'

const table = {
  columns: ['year', 'rape', 'migration'],
  rows: [['2018', 10, 100], ['2019', 12, 90], ['2020', 15, 80]],
}

describe('buildChartProps', () => {
  it('bar_h → {data, maxBars}', () => {
    const p = buildChartProps(table, { chart: 'bar_h', x: 'year', y: 'rape' })
    expect(p.data.map((d) => d.value)).toEqual([10, 12, 15])
    expect(p.maxBars).toBe(30)
  })

  it('stat → summed total', () => {
    const p = buildChartProps(table, { chart: 'stat', x: 'year', y: 'rape' })
    expect(p.value).toBe((37).toLocaleString())
  })

  it('line → one series per chosen column, numeric x detected', () => {
    const p = buildChartProps(table, { chart: 'line', x: 'year', series: ['rape', 'migration'] })
    expect(p.series.map((s) => s.name)).toEqual(['rape', 'migration'])
    expect(p.series[0].points).toEqual([{ x: '2018', y: 10 }, { x: '2019', y: 12 }, { x: '2020', y: 15 }])
    expect(p.xIsNumeric).toBe(true)
  })

  it('line falls back to y when no series list', () => {
    const p = buildChartProps(table, { chart: 'line', x: 'year', y: 'rape' })
    expect(p.series.map((s) => s.name)).toEqual(['rape'])
  })

  it('corr_matrix → square Pearson matrix, diagonal 1', () => {
    const p = buildChartProps(table, { chart: 'corr_matrix', corrCols: ['rape', 'migration'] })
    expect(p.vars).toEqual(['rape', 'migration'])
    expect(p.matrix[0][0]).toBe(1)
    expect(p.matrix[1][1]).toBe(1)
    // rape ↑ while migration ↓ → strong negative
    expect(p.matrix[0][1]).toBeLessThan(-0.9)
  })

  it('corr_matrix: null cells excluded pairwise, not coerced to 0', () => {
    const t = {
      columns: ['country', 'a', 'b'],
      rows: [['FR', 1, 2], ['DE', 2, 4], ['PL', 3, 6], ['IE', null, 9]],
    }
    const p = buildChartProps(t, { chart: 'corr_matrix', corrCols: ['a', 'b'] })
    // IE lacks `a`: the pair must be dropped, leaving a perfect fit.
    expect(p.matrix[0][1]).toBeCloseTo(1, 6)
  })

  it('corr_matrix with <2 cols returns empty matrix', () => {
    const p = buildChartProps(table, { chart: 'corr_matrix', corrCols: ['rape'] })
    expect(p.matrix).toEqual([])
  })

  it('null result → null', () => {
    expect(buildChartProps(null, { chart: 'bar_h', x: 'year', y: 'rape' })).toBeNull()
  })
})
