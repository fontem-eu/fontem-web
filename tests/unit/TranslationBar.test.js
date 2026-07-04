import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TranslationBar from '../../src/components/TranslationBar.vue'
import { defaultTranslationFor } from '../../src/utils/translationDefault.js'

describe('TranslationBar (story page language picker)', () => {
  it('hides entirely when the story has no translations', () => {
    const w = mount(TranslationBar, { props: { language: 'en', translations: [] } })
    expect(w.find('[data-testid="translation-bar"]').exists()).toBe(false)
  })

  it('renders one select with the translate icon: original first, then translations', () => {
    const w = mount(TranslationBar, {
      props: { language: 'en', translations: [{ lang: 'pt', outdated: false }, { lang: 'hu', outdated: true }] },
    })
    expect(w.find('.tbar-icon svg').exists()).toBe(true)
    const opts = w.findAll('[data-testid="translation-picker"] option')
    expect(opts.length).toBe(3)
    expect(opts[0].text()).toContain('English')
    expect(opts[0].text()).toContain('Original')
    expect(opts[1].text()).toContain('Português')
    expect(opts[2].text()).toContain('Magyar')
    expect(opts[2].text()).toContain('⚠') // outdated marker in the list
  })

  it('emits switch with the lang ("" for original)', async () => {
    const w = mount(TranslationBar, {
      props: { language: 'en', current: '', translations: [{ lang: 'pt', outdated: false }] },
    })
    await w.find('[data-testid="translation-picker"]').setValue('pt')
    await w.setProps({ current: 'pt' })
    await w.find('[data-testid="translation-picker"]').setValue('')
    expect(w.emitted('switch')).toEqual([['pt'], ['']])
  })

  it('shows the yellow outdated badge only for the ACTIVE outdated translation', async () => {
    const w = mount(TranslationBar, {
      props: { language: 'en', current: '', translations: [{ lang: 'pt', outdated: true }] },
    })
    expect(w.find('[data-testid="translation-outdated-badge"]').exists()).toBe(false)
    await w.setProps({ current: 'pt' })
    const badge = w.find('[data-testid="translation-outdated-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('possibly outdated')
  })

  it('up-to-date active translation shows no badge', () => {
    const w = mount(TranslationBar, {
      props: { language: 'en', current: 'pt', translations: [{ lang: 'pt', outdated: false }] },
    })
    expect(w.find('[data-testid="translation-outdated-badge"]').exists()).toBe(false)
  })
})

describe('defaultTranslationFor (which text a story opens in)', () => {
  const tr = [{ lang: 'pt', outdated: false }, { lang: 'fr', outdated: true }]
  it('prefers the translation matching the UI language', () => {
    expect(defaultTranslationFor('pt', 'en', tr)).toBe('pt')
    expect(defaultTranslationFor('fr', 'en', tr)).toBe('fr') // outdated still preferred (badge warns)
  })
  it('falls back to the original when no translation matches', () => {
    expect(defaultTranslationFor('de', 'en', tr)).toBe('')
  })
  it('uses the original when the UI language IS the original', () => {
    expect(defaultTranslationFor('en', 'en', tr)).toBe('')
  })
  it('handles unset UI language and empty translation lists', () => {
    expect(defaultTranslationFor('', 'en', tr)).toBe('')
    expect(defaultTranslationFor('pt', 'en', [])).toBe('')
    expect(defaultTranslationFor('pt', 'en', undefined)).toBe('')
  })
})
