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
// 5-stop ramps — enough detail for a choropleth, few enough that the
// legend stays scannable. Two families: sequential (single-direction
// data) and diverging (data straddles a midpoint, e.g. 0).
//
// Hex values pinned here so we don't pull a colormap library just
// for ~50 swatches. matplotlib + ColorBrewer are the sources.
//
// `cvd` flag: ✓ if the palette is robust against red/green colour-
// vision deficiencies. The picker shows a small "✓ CVD" badge so
// users know which choices stay legible for everyone.

const PALETTES = {
  // Auto: caller's `kind` decides between viridis/PuOr. The default.
  auto: { label: 'Auto (CVD-safe)', family: 'auto', cvd: true },

  // ── Sequential (single-direction) ─────────────────────────────
  // matplotlib defaults — perceptually uniform, CVD-safe.
  viridis: {
    label: 'Viridis',
    family: 'sequential',
    cvd: true,
    stops: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
  },
  cividis: {
    label: 'Cividis',
    family: 'sequential',
    cvd: true,
    stops: ['#00224e', '#3b496c', '#707173', '#a1a06a', '#fde737'],
  },
  magma: {
    label: 'Magma',
    family: 'sequential',
    cvd: true,
    stops: ['#000004', '#51127c', '#b73779', '#fc8961', '#fcfdbf'],
  },
  plasma: {
    label: 'Plasma',
    family: 'sequential',
    cvd: true,
    stops: ['#0d0887', '#7e03a8', '#cc4778', '#f89540', '#f0f921'],
  },
  // Single-hue ColorBrewer schemes — CVD-safe by construction
  // (no red/green dichotomy).
  blues: {
    label: 'Blues',
    family: 'sequential',
    cvd: true,
    stops: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
  },
  greens: {
    label: 'Greens',
    family: 'sequential',
    cvd: true,
    stops: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
  },
  ylgnbu: {
    label: 'Yellow-Green-Blue',
    family: 'sequential',
    cvd: true,
    stops: ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494'],
  },
  // The classic warm ramp — includes red. Provided because users
  // who can see red expect it, but flagged as not CVD-safe.
  ylorrd: {
    label: 'Yellow-Orange-Red',
    family: 'sequential',
    cvd: false,
    stops: ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'],
  },

  // ── Diverging (around a midpoint, usually 0) ───────────────────
  // ColorBrewer diverging schemes; PuOr / BrBG / PRGn are the
  // standard CVD-safe choices.
  puor: {
    label: 'Purple-Orange',
    family: 'diverging',
    cvd: true,
    stops: ['#7f3b08', '#e08214', '#f7f7f7', '#8073ac', '#2d004b'],
  },
  brbg: {
    label: 'Brown-Blue-Green',
    family: 'diverging',
    cvd: true,
    stops: ['#8c510a', '#dfc27d', '#f5f5f5', '#80cdc1', '#01665e'],
  },
  prgn: {
    label: 'Purple-Green',
    family: 'diverging',
    cvd: true,
    stops: ['#762a83', '#c2a5cf', '#f7f7f7', '#a6dba0', '#1b7837'],
  },
  rdbu: {
    label: 'Red-Blue',
    family: 'diverging',
    cvd: false,
    stops: ['#b2182b', '#ef8a62', '#f7f7f7', '#67a9cf', '#2166ac'],
  },
}

export const PALETTE_CATALOG = PALETTES

// Distinct null colour — sits outside every palette intentionally so
// "no data" can never be confused for a data value. Light-medium gray
// reads correctly on dark and light themes alike.
export const NULL_COLOR = '#cccccc'

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Resolve the user's palette preference + the dataset's data shape
 * to a concrete colour array.
 *
 *   palette === 'auto' (default) → viridis for sequential, PuOr for diverging
 *   palette === 'viridis'        → viridis (regardless of kind)
 *   palette === 'puor'           → PuOr (regardless of kind)
 *   palette family-mismatch      → fall back to auto for the kind, so a
 *                                  user who picked 'blues' (sequential)
 *                                  on diverging data still gets PuOr
 *                                  rather than a broken-looking ramp
 */
function _palette(kind, palette = 'auto') {
  const choice = PALETTES[palette]
  if (!choice || choice.family === 'auto') {
    // Default: pick by data kind.
    return kind === 'diverging' ? PALETTES.puor.stops : PALETTES.viridis.stops
  }
  if (choice.family !== kind) {
    // Family mismatch — caller picked sequential palette for
    // diverging data (or vice versa). Quietly fall back to the
    // CVD-safe default for the actual kind.
    return kind === 'diverging' ? PALETTES.puor.stops : PALETTES.viridis.stops
  }
  return choice.stops
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
 * @param {string}  opts.palette           - palette ID; 'auto' picks by kind
 * @returns MapLibre expression
 */
export function buildColorExpression({ bounds, kind = 'sequential', log = false, palette = 'auto' }) {
  if (!bounds) return NULL_COLOR
  const [lo, hi] = bounds
  const colours = _palette(kind, palette)
  const stops =
    log && kind === 'sequential' && lo > 0
      ? _logStops(lo, hi, colours)
      : _linearStops(lo, hi, colours)

  // The "default" colour (before the first break) is colours[0]. Null
  // values are NOT handled here — they're filtered to a separate layer
  // that paints NULL_COLOR. Mixing both into one step expression
  // produces the same number/null tie-break we're trying to avoid.
  return [
    'step',
    ['get', 'value'],
    colours[0],
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
export function legendStops({ bounds, kind = 'sequential', log = false, palette = 'auto' }) {
  if (!bounds) return []
  const [lo, hi] = bounds
  const colours = _palette(kind, palette)
  const stops =
    log && kind === 'sequential' && lo > 0
      ? _logStops(lo, hi, colours)
      : _linearStops(lo, hi, colours)
  return [
    { value: lo, color: colours[0] },
    ...stops.map(([v, c]) => ({ value: v, color: c })),
    { value: hi, color: colours[colours.length - 1] },
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
