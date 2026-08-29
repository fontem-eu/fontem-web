import { describe, it, expect } from 'vitest'
import { buildChartProps, ENGINE_PATHS } from '../../src/composables/studioPlot.js'

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

// ── Mutation-hardening: line/corr/stat details + engine paths ──────
describe('buildChartProps details', () => {
  const table = {
    columns: ['month', 'contracts', 'eur'],
    rows: [['2024-01', 5, 100], ['2024-02', 7, 200], ['2024-03', null, 300]],
  }

  it('line series drop non-numeric points and label by the single column', () => {
    const props = buildChartProps(table, { chart: 'line', x: 'month', y: 'contracts' })
    // Number(null) is 0 — a null cell charts as 0, only NaN-ish drop out
    expect(props.series).toEqual([{
      name: 'contracts',
      points: [{ x: '2024-01', y: 5 }, { x: '2024-02', y: 7 }, { x: '2024-03', y: 0 }],
    }])
    expect(props.xLabel).toBe('month')
    expect(props.yLabel).toBe('contracts')
    expect(props.xIsNumeric).toBe(false)
  })

  it('multi-series lines label the y axis Value', () => {
    const props = buildChartProps(table, { chart: 'line', x: 'month', series: ['contracts', 'eur'] })
    expect(props.series.map((s) => s.name)).toEqual(['contracts', 'eur'])
    expect(props.yLabel).toBe('Value')
  })

  it('a numeric x axis is flagged, tolerating gaps', () => {
    const t = { columns: ['x', 'y'], rows: [[1, 2], [null, 3], ['', 4], [2, 5]] }
    expect(buildChartProps(t, { chart: 'line', x: 'x', y: 'y' }).xIsNumeric).toBe(true)
    const mixed = { columns: ['x', 'y'], rows: [[1, 2], ['abc', 3]] }
    expect(buildChartProps(mixed, { chart: 'line', x: 'x', y: 'y' }).xIsNumeric).toBe(false)
  })

  it('line returns null when no requested series column exists', () => {
    expect(buildChartProps(table, { chart: 'line', x: 'month', series: ['nope'] })).toBeNull()
    expect(buildChartProps(table, { chart: 'line', x: 'month' })).toBeNull()
  })

  it('corr_matrix keeps only known columns and needs two of them', () => {
    const out = buildChartProps(table, { chart: 'corr_matrix', corrCols: ['contracts', 'nope'] })
    expect(out).toEqual({ vars: ['contracts'], matrix: [] })
    const full = buildChartProps(table, { chart: 'corr_matrix', corrCols: ['contracts', 'eur'] })
    expect(full.vars).toEqual(['contracts', 'eur'])
    expect(full.matrix[0][0]).toBe(1)
    expect(full.matrix[1][1]).toBe(1)
  })

  it('stat sums the y column, treating non-numerics as zero', () => {
    expect(buildChartProps(table, { chart: 'stat', x: 'month', y: 'contracts' }))
      .toEqual({ value: '12', label: 'contracts' })
  })

  it('bar/ts_line map label-value pairs with their display extras', () => {
    const bar = buildChartProps(table, { chart: 'bar_h', x: 'month', y: 'contracts' })
    expect(bar.data[0]).toEqual({ label: '2024-01', value: 5 })
    expect(bar.data[2]).toEqual({ label: '2024-03', value: 0 })
    expect(bar.maxBars).toBe(30)
    const ts = buildChartProps(table, { chart: 'ts_line', x: 'month', y: 'contracts' })
    expect(ts.valueLabel).toBe('contracts')
  })

  it('engine paths stay pinned to the query endpoints', () => {
    expect(ENGINE_PATHS).toEqual({
      cypher: '/api/query/cypher', sql: '/api/query/sql', sparql: '/api/sparql',
    })
  })
})
