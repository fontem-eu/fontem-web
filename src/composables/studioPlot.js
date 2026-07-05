import { pearson, toFiniteOrNaN } from '../utils/vizPalette.js'

// Correlation matrix: pairwise Pearson r across the chosen numeric columns.
function buildCorrProps(result, corrCols) {
  const cols = (corrCols || []).filter((c) => result.columns.includes(c))
  if (cols.length < 2) return { vars: cols, matrix: [] }
  const series = cols.map((c) => {
    const ci = result.columns.indexOf(c)
    // Preserve missing as NaN — Number(null) is 0, which would enter
    // the correlation as a real value (see pearson()).
    return result.rows.map((r) => toFiniteOrNaN(r[ci]))
  })
  const matrix = series.map((a, i) => series.map((b, j) => (i === j ? 1 : pearson(a, b))))
  return { vars: cols, matrix }
}

// Multi-series line: one shared x, one line per chosen series column.
function buildLineProps(result, x, xi, y, seriesSpec) {
  let cols
  if (seriesSpec?.length) cols = seriesSpec
  else if (y) cols = [y]
  else cols = []
  cols = cols.filter((c) => result.columns.includes(c))
  if (!cols.length) return null
  const xVals = result.rows.map((r) => r[xi])
  const xIsNumeric = xVals.some((v) => Number.isFinite(Number(v)))
    && xVals.every((v) => v == null || v === '' || Number.isFinite(Number(v)))
  const series = cols.map((c) => {
    const ci = result.columns.indexOf(c)
    return {
      name: c,
      points: result.rows
        .map((r) => ({ x: r[xi], y: Number(r[ci]) }))
        .filter((pt) => Number.isFinite(pt.y)),
    }
  })
  return { series, xLabel: x, yLabel: cols.length === 1 ? cols[0] : 'Value', xIsNumeric }
}

/** Build ChartSpec props from a { columns, rows } table + a plot spec. */
export function buildChartProps(result, spec = {}) {
  const { chart, x, y } = spec
  if (!result) return null
  if (chart === 'corr_matrix') return buildCorrProps(result, spec.corrCols)
  if (!x) return null
  const xi = result.columns.indexOf(x)
  if (chart === 'line') return buildLineProps(result, x, xi, y, spec.series)
  const yi = result.columns.indexOf(y)
  if (chart === 'stat') {
    const total = result.rows.reduce((s, row) => s + (Number(row[yi]) || 0), 0)
    return { value: total.toLocaleString(), label: y }
  }
  const data = result.rows.map((row) => ({ label: String(row[xi]), value: Number(row[yi]) || 0 }))
  return chart === 'ts_line' ? { data, valueLabel: y } : { data, maxBars: 30 }
}

export const ENGINE_PATHS = { cypher: '/api/query/cypher', sql: '/api/query/sql', sparql: '/api/sparql' }

/** Fetch one source query result as { name, columns, rows } (SPARQL normalized). */
export async function fetchSource(s) {
  const res = await fetch(ENGINE_PATHS[s.lang], {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: s.query }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
  if (s.lang === 'sparql') {
    const cols = body.head?.vars || []
    return { name: s.name, columns: cols, rows: (body.results?.bindings || []).map((b) => cols.map((c) => b[c]?.value ?? null)) }
  }
  return { name: s.name, columns: body.columns || [], rows: body.rows || [] }
}
