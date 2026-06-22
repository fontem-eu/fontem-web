/**
 * chart_snapshot widget — shared helpers.
 *
 * A "chart snapshot" is a serialisable capture of one of the generic
 * chart primitives (StatCard / HorizontalBarChart / GaugeChart /
 * ZoomableBarChart / ZoomableLineChart). It lets ANY plot built from
 * those primitives be saved to the pocket and re-rendered later,
 * without each plot needing its own widget type.
 *
 * Config shape: { chart, props, title }
 *   chart  — one of CHART_TYPES
 *   props  — the primitive's props, JSON-safe (functions dropped)
 *   title  — display/default name
 */
import { fmtEur } from '../utils/format.js'

// Logical chart type -> handled by ChartSpec.vue's component map.
export const CHART_TYPES = ['stat', 'bar_h', 'gauge', 'ts_bar', 'ts_line']

// Named, serialisable value formatters. Callers pass a `format` STRING
// (not a function) so the choice survives serialisation; ChartSpec
// turns it back into a `formatValue` function at render time.
export const VALUE_FORMATTERS = {
  number: (v) => Number(v).toLocaleString(),
  eur: (v) => fmtEur(v),
  pct: (v) => `${v}%`,
}

export function resolveFormatter(format) {
  return VALUE_FORMATTERS[format] || null
}

/**
 * Strip a primitive's props down to something JSON-serialisable:
 * drop functions (e.g. an inline formatValue) and undefined. The
 * `format` string is kept so formatting survives a round-trip.
 */
export function serializeChartProps(props) {
  const out = {}
  for (const [k, v] of Object.entries(props || {})) {
    if (typeof v === 'function' || v === undefined) continue
    out[k] = v
  }
  return JSON.parse(JSON.stringify(out))
}
