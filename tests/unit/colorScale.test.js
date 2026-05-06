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
