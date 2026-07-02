/**
 * Schema-aware autocomplete vocabulary for the Data Studio editors.
 *
 * Combines language keywords with the live store schema (from
 * /api/query/schema/{lang}) so the editor suggests real node labels /
 * tables / classes and their properties / columns / predicates — not just
 * syntax. SQL uses @codemirror/lang-sql's own schema completion (built from
 * `sqlSchema` below); Cypher + SPARQL use `completionSource`.
 */

// Read-only keyword sets (write/DDL keywords are intentionally omitted).
export const KEYWORDS = {
  cypher: [
    'MATCH', 'OPTIONAL MATCH', 'WHERE', 'RETURN', 'WITH', 'ORDER BY', 'SKIP', 'LIMIT',
    'AS', 'AND', 'OR', 'NOT', 'IN', 'IS NULL', 'IS NOT NULL', 'DISTINCT', 'UNWIND',
    'CALL', 'YIELD', 'UNION', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'STARTS WITH',
    'ENDS WITH', 'CONTAINS', 'count', 'sum', 'avg', 'min', 'max', 'collect', 'size',
    'toInteger', 'toFloat', 'toLower', 'toUpper', 'coalesce', 'exists',
  ],
  sparql: [
    'SELECT', 'DISTINCT', 'WHERE', 'PREFIX', 'FILTER', 'OPTIONAL', 'UNION', 'GRAPH',
    'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'BIND', 'VALUES', 'AS', 'ASC',
    'DESC', 'a', 'ASK', 'CONSTRUCT', 'DESCRIBE', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
    'STR', 'LANG', 'REGEX', 'BOUND', 'IF', 'CONCAT',
  ],
  sql: [],
}

const localName = (uri) => (uri || '').split(/[#/]/).findLast(Boolean) || uri

/** Build the completion option list for cypher/sparql from a schema payload. */
export function buildVocab(lang, schema) {
  const kw = (KEYWORDS[lang] || []).map((k) => ({ label: k, type: 'keyword' }))
  if (lang === 'cypher' && schema) {
    const labels = (schema.labels || []).map((l) => ({ label: l, type: 'class', detail: 'node' }))
    const rels = (schema.relationshipTypes || []).map((r) => ({ label: r, type: 'type', detail: 'relationship' }))
    const props = (schema.properties || []).map((p) => ({ label: p, type: 'property' }))
    return [...labels, ...rels, ...props, ...kw]
  }
  if (lang === 'sparql' && schema) {
    const classes = (schema.classes || []).map((u) => ({ label: localName(u), type: 'class', detail: u, apply: `<${u}>` }))
    const preds = (schema.predicates || []).map((u) => ({ label: localName(u), type: 'property', detail: u, apply: `<${u}>` }))
    return [...classes, ...preds, ...kw]
  }
  return kw
}

/** CodeMirror completion source for cypher/sparql (SQL uses lang-sql's schema). */
export function completionSource(lang, schema) {
  const options = buildVocab(lang, schema)
  return (ctx) => {
    // Match only the identifier segment (word chars) so a Cypher `c:Comp`
    // completes the label `Company` — not `c:Comp`. Same for `n.prop`.
    const word = ctx.matchBefore(/\w*/)
    if (!word || (word.from === word.to && !ctx.explicit)) return null
    return { from: word.from, options, validFor: /^\w*$/ }
  }
}

/** lang-sql `schema` map: { tableName: [columnNames] } from the SQL schema payload. */
export function sqlSchemaMap(schema) {
  if (!schema?.tables) return {}
  const out = {}
  for (const t of schema.tables) out[t.name] = (t.columns || []).map((c) => c.name)
  return out
}
