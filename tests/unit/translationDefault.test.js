import { describe, it, expect } from 'vitest'
import { defaultTranslationFor } from '../../src/utils/translationDefault.js'

const CURRENT = { lang: 'pt', outdated: false }
const STALE = { lang: 'pt', outdated: true }

describe('defaultTranslationFor', () => {
  it('opens the reader UI language when a current translation exists', () => {
    expect(defaultTranslationFor('pt', 'en', [CURRENT])).toBe('pt')
  })
  it('opens the original when the UI language IS the original', () => {
    expect(defaultTranslationFor('en', 'en', [CURRENT])).toBe('')
  })
  it('opens the original when no translation matches', () => {
    expect(defaultTranslationFor('de', 'en', [CURRENT])).toBe('')
  })
  it('opens the original when the UI language is unknown', () => {
    expect(defaultTranslationFor('', 'en', [CURRENT])).toBe('')
    expect(defaultTranslationFor(undefined, 'en', [CURRENT])).toBe('')
  })
  it('handles a missing translations list', () => {
    expect(defaultTranslationFor('pt', 'en', undefined)).toBe('')
    expect(defaultTranslationFor('pt', 'en', [])).toBe('')
  })

  // The regression this whole change exists for: a Portuguese reader was
  // silently served a stale pt translation of an article that had been
  // rewritten, and read outdated facts without ever touching the picker.
  it('NEVER auto-opens an outdated translation — falls back to the original', () => {
    expect(defaultTranslationFor('pt', 'en', [STALE])).toBe('')
  })
  it('picks a current translation even when other languages are stale', () => {
    expect(defaultTranslationFor('pt', 'en', [
      { lang: 'fr', outdated: true }, CURRENT, { lang: 'es', outdated: true },
    ])).toBe('pt')
  })
})
