import { describe, it, expect } from 'vitest'
import {
  categorical, lerpColor, divergingColor, pearson, tercileBreaks, tercileClass, DIVERGING,
  contrast, inkFor,
} from '../../src/utils/vizPalette.js'

describe('vizPalette', () => {
  it('categorical wraps in fixed order', () => {
    expect(categorical(0)).toBe('#2a78d6')
    expect(categorical(8)).toBe(categorical(0))
    expect(categorical(-1)).toBe(categorical(7))
  })

  it('lerpColor blends endpoints', () => {
    expect(lerpColor('#000000', '#ffffff', 0)).toBe('#000000')
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('divergingColor: mid=grey, low→blue, high→red', () => {
    expect(divergingColor(0, -1, 1, 0)).toBe(DIVERGING.mid)
    expect(divergingColor(-1, -1, 1, 0)).toBe(DIVERGING.low)
    expect(divergingColor(1, -1, 1, 0)).toBe(DIVERGING.high)
    expect(divergingColor(NaN, -1, 1)).toBe(DIVERGING.mid)
  })

  it('contrast + inkFor: readable ink on any fill, both themes', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrast('#e9e7e2', '#e9e7e2')).toBeCloseTo(1, 5)
    // the diverging midpoint is light: ink must be dark, not the theme text
    expect(inkFor(DIVERGING.mid)).toBe('#000000')
    // a deep saturated fill takes white ink
    expect(inkFor('#1e3a8a')).toBe('#ffffff')
    // whichever ink is chosen, it clears 4.5:1 on every diverging fill
    for (let r = -1; r <= 1.001; r += 0.1) {
      const fill = divergingColor(r, -1, 1, 0)
      expect(contrast(fill, inkFor(fill))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('pearson: +1 / -1 / null on constant', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 6)
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 6)
    expect(pearson([1, 1, 1], [2, 4, 6])).toBeNull() // zero variance
    expect(pearson([1], [2])).toBeNull() // too few
    // pairwise-complete: NaNs dropped
    expect(pearson([1, 2, 3, NaN], [2, 4, 6, 9])).toBeCloseTo(1, 6)
  })

  it('terciles bucket a range into 0/1/2', () => {
    const b = tercileBreaks([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(tercileClass(0, b)).toBe(0)
    expect(tercileClass(4, b)).toBe(1)
    expect(tercileClass(8, b)).toBe(2)
    expect(tercileClass(NaN, b)).toBe(0)
  })
})
