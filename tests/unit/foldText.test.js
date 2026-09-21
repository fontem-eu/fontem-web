/**
 * Text folding — has to agree with the API's fold(), which pre-folds the
 * NUTS search index the picker matches against.
 */
import { describe, it, expect } from 'vitest'
import { foldText } from '../../src/utils/foldText.js'

describe('foldText', () => {
  it('lowercases and strips accents', () => {
    expect(foldText('Ática')).toBe('atica')
    expect(foldText('Łódzkie')).toBe('łodzkie')
    expect(foldText('Bergstraße')).toBe('bergstrasse')
  })

  it('normalises Greek the way casefold() does', () => {
    /** JS toLowerCase() leaves a final sigma (ς) where Python casefold()
     *  writes a medial one, so a Greek query would miss the index. */
    expect(foldText('Αττική')).toBe('αττικη')
    expect(foldText('Περιφέρεια Αττικής')).toBe('περιφερεια αττικησ')
  })

  it('collapses whitespace', () => {
    expect(foldText('  Grande   Lisboa ')).toBe('grande lisboa')
  })

  it('is safe on nothing', () => {
    expect(foldText('')).toBe('')
    expect(foldText(null)).toBe('')
    expect(foldText(undefined)).toBe('')
  })
})
