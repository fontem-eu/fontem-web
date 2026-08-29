import { describe, it, expect } from 'vitest'
import { detectNuts, looksLikeNuts } from '../../src/composables/nutsDetect.js'

describe('nutsDetect', () => {
  it('recognizes NUTS code shapes and rejects others', () => {
    expect(looksLikeNuts('DE')).toBe(true)      // L0
    expect(looksLikeNuts('DE9')).toBe(true)     // L1
    expect(looksLikeNuts('ITH3')).toBe(true)    // L2
    expect(looksLikeNuts('DE111')).toBe(true)   // L3
    expect(looksLikeNuts('Germany')).toBe(false)
    expect(looksLikeNuts('12345')).toBe(false)
    expect(looksLikeNuts('de11')).toBe(false)   // must be upper
  })

  it('detects the geo column + level (L2) and a numeric value column', () => {
    const cols = ['region', 'offences']
    const rows = [['ITH3', 100], ['ITI1', 250], ['DEA1', 90]]
    expect(detectNuts(cols, rows)).toEqual({ geoCol: 'region', valueCol: 'offences', level: 2 })
  })

  it('detects level 0 for 2-letter country codes', () => {
    const rows = [['DE', 5], ['FR', 9], ['ES', 3], ['UK', 7]]
    expect(detectNuts(['geo', 'v'], rows)).toEqual({ geoCol: 'geo', valueCol: 'v', level: 0 })
  })

  it('detects an alpha-3 country column as a level-0 (country) map', () => {
    const rows = [['HUN', 47], ['DEU', 22], ['FRA', 17], ['POL', 60]]
    expect(detectNuts(['country', 'pct'], rows)).toEqual({ geoCol: 'country', valueCol: 'pct', level: 0 })
  })

  it('does NOT mistake NUTS L1 all-letter codes (DEA/DEB) for alpha-3', () => {
    const rows = [['DEA', 1], ['DEB', 2], ['DEC', 3]]
    // DEA/DEB/DEC are NUTS L1 (not in the alpha-3 country set) -> level 1, not 0
    expect(detectNuts(['g', 'v'], rows).level).toBe(1)
  })

  it('returns null when no column looks like NUTS', () => {
    expect(detectNuts(['name', 'n'], [['Acme', 1], ['Globex', 2]])).toBeNull()
  })

  it('picks the modal level when lengths are mixed', () => {
    // mostly L1 (len 3), one stray → level 1
    const rows = [['DE9', 1], ['DEA', 2], ['DEB', 3], ['DE', 4]]
    expect(detectNuts(['g', 'v'], rows).level).toBe(1)
  })
})

// ── Mutation-hardening: the alpha-3 set, filters and fallbacks ─────
describe('alpha-3 country set is exact', () => {
  const CODES = ['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU',
    'GRC', 'HUN', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'POL', 'PRT',
    'ROU', 'SVK', 'SVN', 'ESP', 'SWE', 'GBR', 'CHE', 'NOR', 'ISL', 'LIE', 'ALB',
    'BIH', 'MKD', 'MNE', 'SRB', 'TUR', 'XKX', 'MDA', 'UKR', 'RUS', 'BLR']
  // If a code drops out of the set it stops reading as a country column and
  // the 3-letter shape falls through to NUTS level 1 — a visibly wrong map.
  it.each(CODES)('%s detects as a country-level geo axis', (code) => {
    expect(detectNuts(['c', 'v'], [[code, 1], [code, 2]]))
      .toEqual({ geoCol: 'c', valueCol: 'v', level: 0 })
  })

  it('non-country all-letter L1 codes stay NUTS level 1', () => {
    expect(detectNuts(['c', 'v'], [['DEA', 1], ['DEB', 2]]).level).toBe(1)
  })
})

describe('detectNuts edge behaviour', () => {
  it('returns null for missing/empty inputs', () => {
    expect(detectNuts(null, [['DE', 1]])).toBeNull()
    expect(detectNuts([], [['DE', 1]])).toBeNull()
    expect(detectNuts(['c'], null)).toBeNull()
    expect(detectNuts(['c'], [])).toBeNull()
  })

  it('ignores null/undefined/empty cells when scoring', () => {
    const rows = [['DEU', 1], [null, 2], [undefined, 3], ['', 4], ['DEU', 5]]
    expect(detectNuts(['c', 'v'], rows)).toEqual({ geoCol: 'c', valueCol: 'v', level: 0 })
  })

  it('returns null when a column is entirely empty cells', () => {
    expect(detectNuts(['c'], [[null], [''], [undefined]])).toBeNull()
  })

  it('accepts numeric strings as the value axis, but not blanks', () => {
    expect(detectNuts(['c', 'v'], [['DEU', '5'], ['FRA', '7']]).valueCol).toBe('v')
    // ' ' and 'abc' are not numeric → still picks v as first non-geo column
    expect(detectNuts(['c', 'v'], [['DEU', ' '], ['FRA', 'abc']]).valueCol).toBe('v')
  })

  it('falls back to the geo column itself when it is the only column', () => {
    expect(detectNuts(['c'], [['DEU'], ['FRA']]))
      .toEqual({ geoCol: 'c', valueCol: 'c', level: 0 })
    expect(detectNuts(['c'], [['ITH3'], ['ITI1']]))
      .toEqual({ geoCol: 'c', valueCol: 'c', level: 2 })
  })

  it('prefers the higher-scoring geo column', () => {
    // col a: half NUTS; col b: all NUTS → b wins
    const rows = [['xx', 'ITH3', 1], ['DE11', 'ITI1', 2]]
    expect(detectNuts(['a', 'b', 'v'], rows).geoCol).toBe('b')
  })

  it('skips columns below the min score', () => {
    // 1 of 3 values NUTS-shaped → below 0.8 → no detection
    expect(detectNuts(['c', 'v'], [['DE11', 1], ['xx', 2], ['yy', 3]])).toBeNull()
  })

  it('honours a custom minScore', () => {
    const rows = [['DE11', 1], ['xx', 2]]
    expect(detectNuts(['c', 'v'], rows, { minScore: 0.5 })).not.toBeNull()
  })
})
