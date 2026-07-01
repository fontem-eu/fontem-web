/** Build ChartSpec props from a { columns, rows } table + a plot spec. */
export function buildChartProps(result, { chart, x, y } = {}) {
  if (!result || !x) return null
  const xi = result.columns.indexOf(x)
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
