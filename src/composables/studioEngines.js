/**
 * Shared query-engine metadata + a single-source runner for the Data Studio.
 * Source queries run through Fontem's read-only, row/timeout-capped proxies
 * (Cypher -> Neo4j, SQL -> stats/Eurostat, SPARQL -> Virtuoso). Returns a tidy
 * { columns, rows } table (SPARQL bindings are normalized to the same shape).
 */
export const ENGINES = [
  {
    key: 'cypher', label: 'Cypher', store: 'Neo4j graph', path: '/api/query/cypher',
    sample: 'MATCH (c:Company)-[:AWARDED_TO]-(ct:Contract)\nRETURN c.name AS company, count(ct) AS contracts\nORDER BY contracts DESC LIMIT 20',
  },
  {
    key: 'sql', label: 'SQL', store: 'stats / Eurostat', path: '/api/query/sql',
    sample: "SELECT geo_code AS country, value\nFROM observation\nWHERE dataset = 'crim_off_cat'\nLIMIT 50",
  },
  {
    key: 'sparql', label: 'SPARQL', store: 'Virtuoso RDF', path: '/api/sparql',
    sample: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 20',
  },
]

export function engine(lang) { return ENGINES.find((e) => e.key === lang) || ENGINES[0] }

/** Run one source query. Returns { columns, rows }. Throws on error. */
export async function runSource(lang, query) {
  const eng = engine(lang)
  const res = await fetch(eng.path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`)
  if (lang === 'sparql') {
    const cols = body.head?.vars || []
    return { columns: cols, rows: (body.results?.bindings || []).map((b) => cols.map((c) => b[c]?.value ?? null)) }
  }
  return { columns: body.columns || [], rows: body.rows || [] }
}
