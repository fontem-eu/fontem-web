/**
 * Shared data-viz palette + tiny stats helpers for the Data Studio charts.
 *
 * Colours are drawn from a validated design-viz reference instance (see the
 * dataviz method): a fixed-order categorical set, a single-hue blue sequential
 * ramp, a blue↔red diverging pair with a neutral grey midpoint, and Joshua
 * Stevens' classic 3×3 bivariate-choropleth scheme (magenta × teal → dark
 * blue). Assign categorical hues in fixed order — never cycle a 9th.
 */

// Categorical — identity of a series. Fixed order = the CVD-safety mechanism.
export const CATEGORICAL = [
  '#2a78d6', // blue
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
  '#e87ba4', // magenta
  '#eb6834', // orange
]

export const categorical = (i) => CATEGORICAL[((i % CATEGORICAL.length) + CATEGORICAL.length) % CATEGORICAL.length]

// Sequential (magnitude) — one hue, light→dark. Matches the choropleth ramp.
export const SEQUENTIAL_BLUE = ['#f1f5f9', '#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a']

// Diverging (polarity) — two hues + a neutral grey midpoint. Low = blue,
// mid = grey (reads as "nothing"), high = red. Used for correlation (−1..+1)
// and the value-by-alpha map's colour scale.
export const DIVERGING = { low: '#2a78d6', mid: '#e9e7e2', high: '#e34948' }

// Bivariate 3×3 choropleth (Stevens / Brewer). Index [i1][i2], i∈{0,1,2},
// 0 = low. Corner reads: both-low = neutral grey, high var1 = magenta arm,
// high var2 = teal arm, both-high = dark blue.
export const BIVARIATE_3X3 = [
  ['#e8e8e8', '#ace4e4', '#5ac8c8'], // var1 low
  ['#dfb0d6', '#a5add3', '#5698b9'], // var1 mid
  ['#be64ac', '#8c62aa', '#3b4994'], // var1 high
]

// ── colour interpolation ────────────────────────────────────────
function hexToRgb(h) {
  const n = Number.parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

function relLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio (1..21) between two hex colours. */
export function contrast(a, b) {
  const la = relLuminance(a)
  const lb = relLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Ink (text) colour to paint on a filled swatch: dark or white, whichever
 *  contrasts more. Palette fills are theme-independent, so ink must derive
 *  from the fill - a theme token like var(--text) inverts in dark mode and
 *  goes invisible on light fills. */
export function inkFor(fill) {
  return contrast(fill, '#000000') >= contrast(fill, '#ffffff') ? '#000000' : '#ffffff'
}

/** Plain-language strength bucket for a correlation coefficient. Thresholds
 *  follow the common social-science reading (Evans 1996, collapsed to four
 *  bands): |r| < 0.2 none, < 0.4 mild, < 0.7 moderate, else strong.
 *  Returns a key — the UI translates it. Null/NaN -> null. */
export function corrStrength(r) {
  if (r == null || !Number.isFinite(Number(r))) return null
  const a = Math.abs(Number(r))
  if (a < 0.2) return 'none'
  if (a < 0.4) return 'mild'
  if (a < 0.7) return 'moderate'
  return 'strong'
}

/** Linear blend between two hex colours (t in 0..1). */
export function lerpColor(a, b, t) {
  const A = hexToRgb(a); const B = hexToRgb(b)
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t)
}

/** Diverging colour for a value on [min..max] centred at `mid` (default the
 *  midpoint). Below centre interpolates low→grey, above interpolates grey→high. */
export function divergingColor(v, min, max, mid = (min + max) / 2) {
  if (!Number.isFinite(v)) return DIVERGING.mid
  if (v <= mid) {
    const t = mid === min ? 0 : (mid - v) / (mid - min)
    return lerpColor(DIVERGING.mid, DIVERGING.low, Math.max(0, Math.min(1, t)))
  }
  const t = max === mid ? 0 : (v - mid) / (max - mid)
  return lerpColor(DIVERGING.mid, DIVERGING.high, Math.max(0, Math.min(1, t)))
}

// ── stats ───────────────────────────────────────────────────────
/** Number(v), except that missing values (null/undefined/'') stay
 *  missing (NaN) instead of coercing to 0. */
export function toFiniteOrNaN(v) {
  if (v == null || v === '') return Number.NaN
  return Number(v)
}

/** Pearson correlation of two equal-length numeric arrays (pairwise-complete).
 *  Returns null when fewer than 2 finite pairs or zero variance in either.
 *  Missing values (null/undefined/'') are excluded pairwise — they must
 *  never be coerced: Number(null) === 0 passes the isFinite guard and
 *  silently drags r toward whatever zero correlates with. */
export function pearson(xs, ys) {
  const px = []; const py = []
  for (let i = 0; i < xs.length; i += 1) {
    const a = toFiniteOrNaN(xs[i]); const b = toFiniteOrNaN(ys[i])
    if (Number.isFinite(a) && Number.isFinite(b)) { px.push(a); py.push(b) }
  }
  const n = px.length
  if (n < 2) return null
  const mx = px.reduce((s, v) => s + v, 0) / n
  const my = py.reduce((s, v) => s + v, 0) / n
  let sxy = 0; let sxx = 0; let syy = 0
  for (let i = 0; i < n; i += 1) {
    const dx = px[i] - mx; const dy = py[i] - my
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy
  }
  if (sxx === 0 || syy === 0) return null
  return sxy / Math.sqrt(sxx * syy)
}

/** Tercile break points [b1, b2] of a numeric array (33rd/66th percentiles).
 *  Values < b1 → class 0, < b2 → class 1, else → class 2. */
export function tercileBreaks(vals) {
  const v = vals.filter(Number.isFinite).sort((a, b) => a - b)
  if (v.length < 3) return [v[0] ?? 0, v[v.length - 1] ?? 0]
  const at = (q) => v[Math.min(v.length - 1, Math.floor(q * v.length))]
  return [at(1 / 3), at(2 / 3)]
}

/** Class 0/1/2 for a value given tercile breaks. */
export function tercileClass(v, [b1, b2]) {
  if (!Number.isFinite(v)) return 0
  if (v < b1) return 0
  if (v < b2) return 1
  return 2
}
