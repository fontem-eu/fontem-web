/**
 * Tests for src/widgets/atlas/colorScale.js — the single source of
 * truth for choropleth painting across Atlas + Entity NUTS maps.
 */
import { describe, it, expect } from 'vitest'
import {
  buildColorExpression,
  deriveBounds,
  findSliceStats,
  legendStops,
  NULL_COLOR,
  PALETTE_CATALOG,
} from '../../src/widgets/atlas/colorScale.js'

// ── deriveBounds ───────────────────────────────────────────────────

describe('deriveBounds', () => {
  it('uses p02..p98 by default (robust to outliers)', () => {
    const stats = {
      value_min: 0, value_max: 1_000_000,
      value_p02: 100, value_p50: 500, value_p98: 5_000,
    }
    expect(deriveBounds(stats)).toEqual([100, 5_000])
  })

  it('uses min/max when useFullRange is true', () => {
    const stats = {
      value_min: 0, value_max: 1_000_000,
      value_p02: 100, value_p50: 500, value_p98: 5_000,
    }
    expect(deriveBounds(stats, { useFullRange: true })).toEqual([0, 1_000_000])
  })

  it('returns null when stats are missing', () => {
    expect(deriveBounds(null)).toBeNull()
    expect(deriveBounds(undefined)).toBeNull()
  })

  it('returns null when bounds are non-finite', () => {
    expect(deriveBounds({ value_p02: null, value_p98: 5 })).toBeNull()
    expect(deriveBounds({ value_p02: 5, value_p98: null })).toBeNull()
    expect(deriveBounds({ value_p02: NaN, value_p98: 5 })).toBeNull()
  })

  it('handles flat distribution (hi <= lo) without crashing', () => {
    // The legend would otherwise produce NaN tick positions.
    const result = deriveBounds({ value_p02: 100, value_p98: 100 })
    expect(result).not.toBeNull()
    expect(result[0]).toBe(100)
    expect(result[1]).toBeGreaterThan(100)
  })
})

// ── buildColorExpression ───────────────────────────────────────────

describe('buildColorExpression', () => {
  it('returns NULL_COLOR when bounds are absent', () => {
    expect(buildColorExpression({ bounds: null })).toBe(NULL_COLOR)
  })

  it('builds a sequential MapLibre step expression', () => {
    const expr = buildColorExpression({ bounds: [0, 100], kind: 'sequential' })
    expect(expr[0]).toBe('step')
    expect(expr[1]).toEqual(['get', 'value'])
    // 5-stop palette → 1 default + 4 [break, color] pairs = 9 trailing items.
    expect(expr.length).toBe(11)
    // First "default" colour is viridis[0] (dark purple).
    expect(expr[2]).toMatch(/^#440154$/i)
  })

  it('uses PuOr for diverging data', () => {
    const expr = buildColorExpression({
      bounds: [-50, 50], kind: 'diverging',
    })
    // PuOr starts at brown (#7f3b08), ends at purple (#2d004b).
    expect(expr[2]).toMatch(/^#7f3b08$/i)
    expect(expr[expr.length - 1]).toMatch(/^#2d004b$/i)
  })

  it('produces strictly-increasing breakpoints (MapLibre requirement)', () => {
    const expr = buildColorExpression({ bounds: [10, 1000], kind: 'sequential' })
    // step expression interior: pairs of (value, color).
    const breaks = []
    for (let i = 3; i < expr.length; i += 2) breaks.push(expr[i])
    for (let i = 1; i < breaks.length; i++) {
      expect(breaks[i]).toBeGreaterThan(breaks[i - 1])
    }
  })

  it('honours log option when bounds are positive sequential', () => {
    const linear = buildColorExpression({
      bounds: [1, 1_000_000], kind: 'sequential', log: false,
    })
    const log = buildColorExpression({
      bounds: [1, 1_000_000], kind: 'sequential', log: true,
    })
    // Linear breaks land at 200k, 400k, 600k, 800k. Log breaks land
    // at ~16, ~250, ~4k, ~63k. The linear midpoint is much higher.
    expect(linear[5]).toBeGreaterThan(log[5])
  })

  it('falls back to linear when log requested but bounds straddle 0', () => {
    const expr = buildColorExpression({
      bounds: [-10, 10], kind: 'diverging', log: true,
    })
    // Should produce evenly-spaced (linear) breakpoints around zero.
    const breaks = []
    for (let i = 3; i < expr.length; i += 2) breaks.push(expr[i])
    const diffs = []
    for (let i = 1; i < breaks.length; i++) diffs.push(breaks[i] - breaks[i - 1])
    // All diffs equal ⇒ linear.
    diffs.forEach((d) => expect(d).toBeCloseTo(diffs[0], 5))
  })

  // Regression: a company with contracts in exactly one country (or
  // many countries but all of count=1) collapses bounds to [N, N].
  // _linearStops would otherwise produce four stops all at value=N,
  // which is an invalid MapLibre step expression — the layer fails
  // to render and the country reads as gray + no tooltip. The fix
  // is to return a single solid colour (top of palette) instead.
  it('returns a single solid colour when bounds are degenerate (lo === hi)', () => {
    const expr = buildColorExpression({ bounds: [5, 5], kind: 'sequential' })
    expect(typeof expr).toBe('string')
    expect(expr).toMatch(/^#/)
    // Must NOT be the no-data NULL_COLOR — countries with data should
    // be distinguishable from countries without.
    expect(expr).not.toBe(NULL_COLOR)
  })

  it('does not produce a step expression with non-monotonic stops on degenerate bounds', () => {
    // Belt-and-braces: even if a future refactor regresses, the stop
    // values must remain strictly increasing for MapLibre to accept
    // the expression.
    const expr = buildColorExpression({ bounds: [42, 42], kind: 'sequential' })
    if (Array.isArray(expr) && expr[0] === 'step') {
      const stopValues = []
      for (let i = 3; i < expr.length; i += 2) stopValues.push(expr[i])
      for (let i = 1; i < stopValues.length; i++) {
        expect(stopValues[i]).toBeGreaterThan(stopValues[i - 1])
      }
    }
  })
})

// ── legendStops ────────────────────────────────────────────────────

describe('legendStops', () => {
  it('returns empty array when bounds are absent', () => {
    expect(legendStops({ bounds: null })).toEqual([])
  })

  it('returns palette+1 entries (top + bottom edges + interior)', () => {
    const stops = legendStops({ bounds: [0, 100], kind: 'sequential' })
    // 5-colour palette → bottom edge + 4 interior + top edge = 6 entries.
    expect(stops).toHaveLength(6)
    expect(stops[0].value).toBe(0)
    expect(stops[stops.length - 1].value).toBe(100)
  })

  it('legend min/max anchors match the bounds exactly', () => {
    const bounds = [-25, 75]
    const stops = legendStops({ bounds, kind: 'diverging' })
    expect(stops[0].value).toBe(-25)
    expect(stops[stops.length - 1].value).toBe(75)
  })

  it('returns a single swatch for degenerate bounds (lo === hi)', () => {
    // Matches the buildColorExpression fallback so the legend stays
    // consistent with the painted map.
    const stops = legendStops({ bounds: [12, 12], kind: 'sequential' })
    expect(stops).toHaveLength(1)
    expect(stops[0].value).toBe(12)
  })
})

// ── findSliceStats ─────────────────────────────────────────────────

describe('findSliceStats', () => {
  const slices = [
    {
      dimensions: { unit: 'NR', iccs: 'ICCS0101' },
      value_min: 0, value_max: 1000, value_p02: 1, value_p98: 800,
      value_kind: 'sequential',
    },
    {
      dimensions: { unit: 'P_HTHAB', iccs: 'ICCS0101' },
      value_min: 0, value_max: 50, value_p02: 0.1, value_p98: 30,
      value_kind: 'sequential',
    },
  ]

  it('matches by JSON-stringified dimensions', () => {
    const key = JSON.stringify({ unit: 'P_HTHAB', iccs: 'ICCS0101' })
    const hit = findSliceStats(slices, key)
    expect(hit).not.toBeNull()
    expect(hit.value_p98).toBe(30)
  })

  it('returns null when slices are missing', () => {
    expect(findSliceStats(null, '{}')).toBeNull()
    expect(findSliceStats([], '{}')).toBeNull()
  })

  it('returns null when key has no match', () => {
    expect(findSliceStats(slices, '{"unit":"BOGUS"}')).toBeNull()
  })

  it('returns null when key is empty', () => {
    expect(findSliceStats(slices, '')).toBeNull()
  })
})

// ── PALETTE_CATALOG + palette routing ─────────────────────────────

describe('PALETTE_CATALOG', () => {
  it('exposes auto + sequential + diverging entries with cvd flags', () => {
    expect(PALETTE_CATALOG.auto.family).toBe('auto')
    expect(PALETTE_CATALOG.viridis.family).toBe('sequential')
    expect(PALETTE_CATALOG.viridis.cvd).toBe(true)
    expect(PALETTE_CATALOG.puor.family).toBe('diverging')
    expect(PALETTE_CATALOG.puor.cvd).toBe(true)
    // The classic warm ramp must be flagged as NOT CVD-safe so the
    // picker can warn users who pick it.
    expect(PALETTE_CATALOG.ylorrd.cvd).toBe(false)
    expect(PALETTE_CATALOG.rdbu.cvd).toBe(false)
  })
})

describe('buildColorExpression — palette routing', () => {
  it('palette=auto + sequential picks viridis', () => {
    const expr = buildColorExpression({
      bounds: [0, 100], kind: 'sequential', palette: 'auto',
    })
    expect(expr[2]).toMatch(/^#440154$/i)  // viridis[0]
  })

  it('palette=auto + diverging picks PuOr', () => {
    const expr = buildColorExpression({
      bounds: [-50, 50], kind: 'diverging', palette: 'auto',
    })
    expect(expr[2]).toMatch(/^#7f3b08$/i)  // puor[0]
  })

  it('palette=blues uses Blues regardless of kind', () => {
    const expr = buildColorExpression({
      bounds: [0, 100], kind: 'sequential', palette: 'blues',
    })
    expect(expr[2]).toMatch(/^#eff3ff$/i)  // blues[0]
  })

  it('family-mismatch falls back to auto-for-kind (no broken ramp)', () => {
    // User picked a sequential palette ('blues'), but data is
    // diverging — must fall back to the CVD-safe diverging default
    // (PuOr), not paint a sequential ramp across negatives.
    const expr = buildColorExpression({
      bounds: [-10, 10], kind: 'diverging', palette: 'blues',
    })
    expect(expr[2]).toMatch(/^#7f3b08$/i)  // puor[0]
  })

  it('unknown palette IDs collapse to auto', () => {
    const expr = buildColorExpression({
      bounds: [0, 100], kind: 'sequential', palette: 'rainbow-unicorn',
    })
    expect(expr[2]).toMatch(/^#440154$/i)  // viridis[0]
  })
})

// ── Mutation-hardening: pin the palettes (they are accessibility
// decisions — CVD-safe ramps + the distinct null colour) and the
// breakpoint math the map/legend pair depends on. ─────────────────
describe('palette catalogue is exact', () => {
  const EXPECTED = {
    auto: { label: 'Auto (CVD-safe)', family: 'auto', cvd: true },
    viridis: { label: 'Viridis', family: 'sequential', cvd: true,
      stops: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'] },
    cividis: { label: 'Cividis', family: 'sequential', cvd: true,
      stops: ['#00224e', '#3b496c', '#707173', '#a1a06a', '#fde737'] },
    magma: { label: 'Magma', family: 'sequential', cvd: true,
      stops: ['#000004', '#51127c', '#b73779', '#fc8961', '#fcfdbf'] },
    plasma: { label: 'Plasma', family: 'sequential', cvd: true,
      stops: ['#0d0887', '#7e03a8', '#cc4778', '#f89540', '#f0f921'] },
    blues: { label: 'Blues', family: 'sequential', cvd: true,
      stops: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'] },
    greens: { label: 'Greens', family: 'sequential', cvd: true,
      stops: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'] },
    ylgnbu: { label: 'Yellow-Green-Blue', family: 'sequential', cvd: true,
      stops: ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494'] },
    ylorrd: { label: 'Yellow-Orange-Red', family: 'sequential', cvd: false,
      stops: ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'] },
    puor: { label: 'Purple-Orange', family: 'diverging', cvd: true,
      stops: ['#7f3b08', '#e08214', '#f7f7f7', '#8073ac', '#2d004b'] },
    brbg: { label: 'Brown-Blue-Green', family: 'diverging', cvd: true,
      stops: ['#8c510a', '#dfc27d', '#f5f5f5', '#80cdc1', '#01665e'] },
    prgn: { label: 'Purple-Green', family: 'diverging', cvd: true,
      stops: ['#762a83', '#c2a5cf', '#f7f7f7', '#a6dba0', '#1b7837'] },
    rdbu: { label: 'Red-Blue', family: 'diverging', cvd: false,
      stops: ['#b2182b', '#ef8a62', '#f7f7f7', '#67a9cf', '#2166ac'] },
  }
  it('matches the pinned catalogue exactly', () => {
    expect(PALETTE_CATALOG).toEqual(EXPECTED)
  })
  it('null colour stays the distinct light gray', () => {
    expect(NULL_COLOR).toBe('#cccccc')
  })
})

describe('palette resolution fallbacks', () => {
  const stops = (expr) => [expr[2], ...expr.slice(3).filter((_, i) => i % 2 === 1)]
  it('auto picks viridis for sequential and PuOr for diverging', () => {
    expect(stops(buildColorExpression({ bounds: [0, 10], kind: 'sequential' })))
      .toEqual(PALETTE_CATALOG.viridis.stops)
    expect(stops(buildColorExpression({ bounds: [-5, 5], kind: 'diverging' })))
      .toEqual(PALETTE_CATALOG.puor.stops)
  })
  it('a family mismatch quietly falls back to the kind default', () => {
    expect(stops(buildColorExpression({ bounds: [-5, 5], kind: 'diverging', palette: 'blues' })))
      .toEqual(PALETTE_CATALOG.puor.stops)
    expect(stops(buildColorExpression({ bounds: [0, 10], kind: 'sequential', palette: 'puor' })))
      .toEqual(PALETTE_CATALOG.viridis.stops)
  })
  it('an explicit matching palette is honoured', () => {
    expect(stops(buildColorExpression({ bounds: [0, 10], kind: 'sequential', palette: 'greens' })))
      .toEqual(PALETTE_CATALOG.greens.stops)
  })
})

describe('breakpoint math', () => {
  it('linear breaks sit at 1/5..4/5 of the range', () => {
    const expr = buildColorExpression({ bounds: [0, 100], kind: 'sequential' })
    const values = expr.slice(3).filter((_, i) => i % 2 === 0)
    expect(values).toEqual([20, 40, 60, 80])
  })
  it('log breaks are log-spaced for positive sequential bounds', () => {
    const expr = buildColorExpression({ bounds: [1, 10000], kind: 'sequential', log: true })
    const values = expr.slice(3).filter((_, i) => i % 2 === 0)
    const expected = [10 ** 0.8, 10 ** 1.6, 10 ** 2.4, 10 ** 3.2]
    values.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 6))
  })
  it('log falls back to linear when bounds touch zero or negative', () => {
    const expr = buildColorExpression({ bounds: [0, 100], kind: 'sequential', log: true })
    const values = expr.slice(3).filter((_, i) => i % 2 === 0)
    expect(values).toEqual([20, 40, 60, 80])
  })
  it('legend and map share the same interior breakpoints', () => {
    const opts = { bounds: [10, 60], kind: 'sequential', palette: 'blues' }
    const expr = buildColorExpression(opts)
    const exprValues = expr.slice(3).filter((_, i) => i % 2 === 0)
    const legend = legendStops(opts)
    expect(legend[0]).toEqual({ value: 10, color: PALETTE_CATALOG.blues.stops[0] })
    expect(legend.at(-1)).toEqual({ value: 60, color: PALETTE_CATALOG.blues.stops.at(-1) })
    expect(legend.slice(1, -1).map((s) => s.value)).toEqual(exprValues)
  })
})

describe('deriveBounds + findSliceStats', () => {
  it('uses the robust p02..p98 window by default, full range on demand', () => {
    const stats = { value_min: 0, value_max: 100, value_p02: 5, value_p98: 95 }
    expect(deriveBounds(stats)).toEqual([5, 95])
    expect(deriveBounds(stats, { useFullRange: true })).toEqual([0, 100])
  })
  it('rejects missing or non-finite stats', () => {
    expect(deriveBounds(null)).toBeNull()
    expect(deriveBounds({})).toBeNull()
    expect(deriveBounds({ value_p02: 1, value_p98: Infinity })).toBeNull()
  })
  it('returns a degenerate ascending window for flat distributions', () => {
    const [lo, hi] = deriveBounds({ value_p02: 7, value_p98: 7 })
    expect(lo).toBe(7)
    expect(hi).toBeGreaterThan(7)
  })
  it('finds the stats row whose dimensions match the slice key', () => {
    const rows = [
      { dimensions: { unit: 'NR' }, value_p02: 1 },
      { dimensions: { unit: 'P_HTHAB' }, value_p02: 2 },
    ]
    expect(findSliceStats(rows, JSON.stringify({ unit: 'P_HTHAB' })).value_p02).toBe(2)
    expect(findSliceStats(rows, JSON.stringify({ unit: 'XX' }))).toBeNull()
    expect(findSliceStats(null, 'k')).toBeNull()
    expect(findSliceStats(rows, '')).toBeNull()
  })
})
