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
        // toFiniteOrNaN, not Number(): Number(null) is 0, so a missing
        // cell would chart as a real zero — buildCorrProps below already
        // guards against exactly this; line series must too.
        .map((r) => ({ x: r[xi], y: toFiniteOrNaN(r[ci]) }))
        .filter((pt) => Number.isFinite(pt.y)),
    }
  })
  return { series, xLabel: x, yLabel: cols.length === 1 ? cols[0] : 'Value', xIsNumeric }
}

/** Build ChartSpec props from a { columns, rows } table + a plot spec. */
/**
 * Map event rows from a named pipeline source onto chart annotations.
 * spec.events = { source, x, label, detail? } — column names in that
 * source's result. Missing source/columns -> no events (never an error:
 * a story chart must render its series even if the events query moves).
 */
export function extractEvents(spec, inputs) {
  const cfg = spec?.events
  if (!cfg?.source || !cfg.x || !cfg.label) return []
  const src = (inputs || []).find((i) => i.name === cfg.source)
  if (!src) return []
  const xi = src.columns.indexOf(cfg.x)
  const li = src.columns.indexOf(cfg.label)
  const di = cfg.detail ? src.columns.indexOf(cfg.detail) : -1
  if (xi < 0 || li < 0) return []
  return src.rows
    .map((r) => ({ x: r[xi], label: r[li], detail: di >= 0 ? r[di] : undefined }))
    .filter((e) => e.x != null && e.label)
}

export function buildChartProps(result, spec = {}, inputs = []) {
  const { chart, x, y } = spec
  if (!result) return null
  if (chart === 'corr_matrix') return buildCorrProps(result, spec.corrCols)
  if (!x) return null
  const xi = result.columns.indexOf(x)
  if (chart === 'line') {
    const props = buildLineProps(result, x, xi, y, spec.series)
    if (props && spec.events) props.events = extractEvents(spec, inputs)
    return props
  }
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

/**
 * A saved Studio plot spec -> the `pipeline` widget an article embeds.
 *
 * The article does not store a picture or a copy of the rows: it stores
 * the recipe — the sources and the DuckDB transform in `data_params`,
 * the chart choice in `ui_params` — and re-runs it when a reader opens
 * the page. That is what makes an embedded chart follow the data.
 *
 * This exists as one function because there are now two callers that
 * must agree exactly: the Pocket button in StudioPlotView, and the
 * assistant's insert_studio_plot proposal. Two hand-rolled copies of
 * this mapping would drift, and the drift would show up as a chart that
 * renders from one road and not the other. The server builds the same
 * shape in studio_ops.plot_recipe for validation; this is the one that
 * reaches the document.
 */
export function specToPipelineConfig(spec = {}) {
  const ui = {
    chart: spec.chart || 'bar_h',
    x: spec.x || '',
    y: spec.y || '',
    y2: spec.y2 || '',
    level: spec.level || 0,
    bivariate: spec.bivariate || 'none',
    series: Array.isArray(spec.series) ? [...spec.series] : [],
    corrCols: Array.isArray(spec.corrCols) ? [...spec.corrCols] : [],
  }
  if (spec.events && Object.keys(spec.events).length) ui.events = { ...spec.events }
  return {
    data_params: {
      sources: Array.isArray(spec.sources) ? spec.sources.map((x) => ({ ...x })) : [],
      transform: spec.transform || '',
    },
    ui_params: ui,
  }
}
