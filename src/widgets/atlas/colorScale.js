/**
 * Atlas colour scale — single source of truth for choropleth painting.
 *
 * Used by AtlasView, AtlasMapEmbed, and EntityNutsMap. The three
 * components used to each carry their own copy of a hardcoded
 * blue→red ramp (red is bad for red/green CVD; the same colour
 * meant different values across years). This module replaces that
 * with three things:
 *
 *   1. CVD-friendly palettes
 *      - viridis  for sequential (always-positive) data — perceptually
 *        uniform, robust under all three CVD types, prints in
 *        grayscale. matplotlib's default since 2017.
 *      - PuOr     for diverging (values straddle 0) — purple at the
 *        negative end, orange at the positive end, neutral at zero.
 *        Standard ColorBrewer choice for CVD-safe diverging.
 *
 *   2. Robust dataset-wide bounds (p02..p98 from the backend's
 *      `dataset_slice_stats`) instead of per-year auto-scale, so the
 *      same colour means the same value across years.
 *
 *   3. Distinct null colour (light gray) — outside both palettes,
 *      so a no-data region reads as "no data" not "low value" or
 *      "worst possible".
 *
 * Optional log-spaced breakpoints for highly skewed datasets
 * (Population, GDP, etc. where p98/p02 spans 3+ orders of magnitude).
 *
 * The module exports two surfaces:
 *
 *   - buildColorExpression(opts) → MapLibre `step` expression
 *   - legendStops(opts) → array used by AtlasLegend.vue
 *
 * Both consume the same `opts` so the legend can never disagree with
 * the map.
 */

// ── Palettes ──────────────────────────────────────────────────────────
//
// Both ramps are 5-stop. Five gives enough detail for a choropleth
// without flooding the legend; matches the scale humans easily count.

// Sampled from matplotlib's `viridis` colormap at t = 0, 0.25, 0.5,
// 0.75, 1.0. Hex values pinned here so we don't pull a colormap
// library just for these five swatches.
const VIRIDIS = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725']

// Sampled from ColorBrewer's `PuOr` (9-class), thinned to 5: 1, 3, 5,
// 7, 9. Symmetric around the centre swatch — when the bounds straddle
// zero, the centre lands on/near zero in the data scale.
const PUOR = ['#7f3b08', '#e08214', '#f7f7f7', '#8073ac', '#2d004b']

// Distinct null colour — sits outside both palettes intentionally so
// "no data" can never be confused for a data value. Light-medium gray
// reads correctly on dark and light themes alike.
export const NULL_COLOR = '#cccccc'

// ── Helpers ───────────────────────────────────────────────────────────

function _palette(kind) {
  return kind === 'diverging' ? PUOR : VIRIDIS
}

function _linearStops(min, max, palette) {
  // 5 stops → 4 internal break points at 1/5, 2/5, 3/5, 4/5 of the
  // range. Each colour binds [break_i, break_{i+1}); the bottom
  // colour is the "default" before the first break.
  const out = []
  for (let i = 0; i < palette.length - 1; i++) {
    const t = (i + 1) / palette.length
    const v = min + t * (max - min)
    out.push([v, palette[i + 1]])
  }
  return out
}

function _logStops(min, max, palette) {
  // For skewed positive data: log-space the breakpoints. Falls back to
  // linear if the bounds straddle zero or are non-positive — caller
  // should pre-check `kind === 'sequential' && min > 0` before opting
  // into log scale.
  if (min <= 0 || max <= 0) return _linearStops(min, max, palette)
  const logMin = Math.log(min)
  const logRange = Math.log(max) - logMin
  const out = []
  for (let i = 0; i < palette.length - 1; i++) {
    const t = (i + 1) / palette.length
    const v = Math.exp(logMin + t * logRange)
    out.push([v, palette[i + 1]])
  }
  return out
}

/**
 * Derive [lo, hi] colour-scale bounds from the backend slice stats.
 *
 * Robust by default: p02..p98 — clips the one or two outlier regions
 * that would otherwise compress the entire ramp into the bottom 5%.
 * Caller can override with `useFullRange: true` (rarely useful).
 *
 * Returns null if the stats are missing / malformed — caller should
 * fall back to per-data bounds (legacy behavior).
 */
export function deriveBounds(sliceStats, { useFullRange = false } = {}) {
  if (!sliceStats) return null
  const lo = useFullRange ? sliceStats.value_min : sliceStats.value_p02
  const hi = useFullRange ? sliceStats.value_max : sliceStats.value_p98
  if (lo == null || hi == null || !Number.isFinite(lo) || !Number.isFinite(hi)) {
    return null
  }
  if (hi <= lo) {
    // Pathological flat distribution — caller will paint a single
    // colour. Return a degenerate window so step expressions still
    // generate cleanly.
    return [lo, lo + (Math.abs(lo) || 1) * 1e-9]
  }
  return [lo, hi]
}

/**
 * Build a MapLibre `step` expression mapping `value` → fill colour.
 *
 * @param {object} opts
 * @param {[number, number]} opts.bounds   - [lo, hi] colour scale window
 * @param {string}  opts.kind              - 'sequential' | 'diverging'
 * @param {boolean} opts.log               - apply log-spaced breakpoints
 *                                           (sequential + min>0 only)
 * @returns MapLibre expression
 */
export function buildColorExpression({ bounds, kind = 'sequential', log = false }) {
  if (!bounds) return NULL_COLOR
  const [lo, hi] = bounds
  const palette = _palette(kind)
  const stops =
    log && kind === 'sequential' && lo > 0
      ? _logStops(lo, hi, palette)
      : _linearStops(lo, hi, palette)

  // The "default" colour (before the first break) is palette[0]. Null
  // values are NOT handled here — they're filtered to a separate layer
  // that paints NULL_COLOR. Mixing both into one step expression
  // produces the same number/null tie-break we're trying to avoid.
  return [
    'step',
    ['get', 'value'],
    palette[0],
    ...stops.flatMap(([v, c]) => [v, c]),
  ]
}

/**
 * Build the legend stop list — same breakpoints as the map expression
 * so the two can never disagree. Each entry is { value, color }.
 *
 * The returned list is the *interior* breakpoints (length = palette
 * length - 1); callers prepend palette[0] for the "below first break"
 * swatch and `bounds[1]` as the upper edge label.
 */
export function legendStops({ bounds, kind = 'sequential', log = false }) {
  if (!bounds) return []
  const [lo, hi] = bounds
  const palette = _palette(kind)
  const stops =
    log && kind === 'sequential' && lo > 0
      ? _logStops(lo, hi, palette)
      : _linearStops(lo, hi, palette)
  return [
    { value: lo, color: palette[0] },
    ...stops.map(([v, c]) => ({ value: v, color: c })),
    { value: hi, color: palette[palette.length - 1] },
  ]
}

/**
 * Pick the slice_stats row matching the active dimension selection.
 *
 * Slice stats are emitted as a list because each dataset can have many
 * dimension combinations (e.g. unit=NR vs unit=P_HTHAB). The frontend
 * holds the active slice as a JSON-string key (`sliceKey`); this
 * function locates the corresponding stats row.
 *
 * Returns null when there's no match (fresh dataset, or stats haven't
 * been backfilled yet) — caller should fall back to per-year bounds.
 */
export function findSliceStats(allSliceStats, sliceKey) {
  if (!Array.isArray(allSliceStats) || !sliceKey) return null
  for (const s of allSliceStats) {
    if (JSON.stringify(s.dimensions || {}) === sliceKey) return s
  }
  return null
}
