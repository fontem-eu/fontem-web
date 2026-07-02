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

  it('returns null when no column looks like NUTS', () => {
    expect(detectNuts(['name', 'n'], [['Acme', 1], ['Globex', 2]])).toBeNull()
  })

  it('picks the modal level when lengths are mixed', () => {
    // mostly L1 (len 3), one stray → level 1
    const rows = [['DE9', 1], ['DEA', 2], ['DEB', 3], ['DE', 4]]
    expect(detectNuts(['g', 'v'], rows).level).toBe(1)
  })
})
