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
