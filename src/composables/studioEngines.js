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
    sample: [
      '-- Recorded offences by region (Eurostat), latest year, joined to NUTS names',
      'SELECT r.name AS region, o.value AS offences',
      'FROM observation o',
      'JOIN nuts_region r ON r.code = o.geo_code',
      "WHERE o.dataset_code = 'crim_off_cat'",
      'ORDER BY o.time DESC, o.value DESC',
      'LIMIT 50',
    ].join('\n'),
  },
  {
    key: 'sparql', label: 'SPARQL', store: 'Virtuoso RDF', path: '/api/sparql',
    sample: [
      '# Top suppliers to the German state — contract value rolled up the ownership',
      '# chain (subsidiaryOf* is a transitive property path to the ultimate parent)',
      'PREFIX f: <http://data.fontem.eu/ontology#>',
      'PREFIX wdt: <http://www.wikidata.org/prop/direct/>',
      'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
      'SELECT ?parent (SUM(?value) AS ?totalEur) (COUNT(?contract) AS ?contracts)',
      'WHERE {',
      '  ?contract a f:Contract ;',
      '            f:awardedBy ?authority ;',
      '            f:awardedTo ?supplier ;',
      '            f:valueEur ?value .',
      '  ?authority wdt:P17 "DEU" .',
      '  ?supplier f:subsidiaryOf* ?top .',
      '  FILTER NOT EXISTS { ?top f:subsidiaryOf ?any }',
      '  ?top rdfs:label ?parent .',
      '}',
      'GROUP BY ?parent',
      'ORDER BY DESC(?totalEur)',
      'LIMIT 20',
    ].join('\n'),
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
