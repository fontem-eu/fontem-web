/**
 * Detect a NUTS-region column (and its level) in a result table.
 *
 * NUTS codes are strongly structured: a 2-letter country prefix + up to 3
 * alphanumerics, and the LENGTH encodes the level — "DE" (L0), "DE9" (L1),
 * "ITH3" (L2), "DE111" (L3). So a column whose values mostly match that shape
 * is a NUTS axis, and the modal length gives the level. This is a best-effort
 * guess to pre-fill the map controls; the user can always override.
 */
const NUTS_RE = /^[A-Z]{2}[A-Z0-9]{0,3}$/
// The platform keys country on alpha-3. A column of these is a country-level
// (NUTS 0) geo axis — distinct from NUTS L1 all-letter codes like DEA/DEB,
// which are not country codes. The map joins alpha-3 via the boundaries'
// country_a3 property.
const ALPHA3 = new Set([
  'AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU',
  'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT',
  'ROU', 'SVK', 'SVN', 'ESP', 'SWE', 'GBR', 'CHE', 'NOR', 'ISL', 'LIE', 'ALB',
  'BIH', 'MKD', 'MNE', 'SRB', 'TUR', 'XKX', 'MDA', 'UKR', 'RUS', 'BLR',
])
const isAlpha3 = (v) => typeof v === 'string' && /^[A-Z]{3}$/.test(v) && ALPHA3.has(v)

export function looksLikeNuts(v) {
  return typeof v === 'string' && v.length >= 2 && v.length <= 5 && NUTS_RE.test(v)
}

const isNumeric = (v) => typeof v === 'number'
  || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))

/**
 * @returns {{geoCol, valueCol, level}|null}
 */
export function detectNuts(columns, rows, { sample = 80, minScore = 0.8 } = {}) {
  if (!columns?.length || !rows?.length) return null
  const sampled = rows.slice(0, sample)

  // 1. alpha-3 country columns -> a country-level (NUTS 0) map.
  let a3best = null
  columns.forEach((col, ci) => {
    const vals = sampled.map((r) => r[ci]).filter((v) => v !== null && v !== undefined && v !== '')
    if (!vals.length) return
    const score = vals.filter(isAlpha3).length / vals.length
    if (score >= minScore && (!a3best || score > a3best.score)) a3best = { geoCol: col, score }
  })
  if (a3best) {
    const valueCol = columns.find((c, ci) => c !== a3best.geoCol && sampled.some((r) => isNumeric(r[ci])))
      || columns.find((c) => c !== a3best.geoCol) || a3best.geoCol
    return { geoCol: a3best.geoCol, valueCol, level: 0 }
  }

  // 2. NUTS-coded columns (length -> level).
  let best = null
  columns.forEach((col, ci) => {
    const vals = sampled.map((r) => r[ci]).filter((v) => v !== null && v !== undefined && v !== '')
    if (!vals.length) return
    const hits = vals.filter(looksLikeNuts)
    const score = hits.length / vals.length
    if (score < minScore) return
    const lenCounts = {}
    hits.forEach((v) => { lenCounts[v.length] = (lenCounts[v.length] || 0) + 1 })
    const modalLen = Number(Object.entries(lenCounts).sort((a, b) => b[1] - a[1])[0][0])
    const level = Math.max(0, Math.min(3, modalLen - 2))
    if (!best || score > best.score) best = { geoCol: col, level, score }
  })
  if (!best) return null
  // Value axis: the first numeric column that isn't the geo column.
  const valueCol = columns.find((c, ci) => c !== best.geoCol && sampled.some((r) => isNumeric(r[ci])))
    || columns.find((c) => c !== best.geoCol)
    || best.geoCol
  return { geoCol: best.geoCol, valueCol, level: best.level }
}
