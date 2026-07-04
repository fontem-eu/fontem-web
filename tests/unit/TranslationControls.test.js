import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TranslationControls from '../../src/components/TranslationControls.vue'

describe('TranslationControls (editor)', () => {
  const translations = [{ lang: 'pt', outdated: true }, { lang: 'de', outdated: false }]

  it('lists original + the other 23 languages, marking existing translations', () => {
    const w = mount(TranslationControls, {
      props: { storyLanguage: 'en', translations, current: '' },
    })
    const opts = w.findAll('option')
    expect(opts.length).toBe(24) // original + 23 (the original language needs no entry)
    expect(opts[0].text()).toContain('Original')
    const texts = opts.map((o) => o.text())
    expect(texts.find((t) => t.startsWith('Português'))).toContain('⚠') // outdated
    expect(texts.find((t) => t.startsWith('Deutsch'))).toContain('✓') // current
  })

  it('emits switch on selection', async () => {
    const w = mount(TranslationControls, {
      props: { storyLanguage: 'en', translations, current: '' },
    })
    await w.find('[data-testid="translation-select"]').setValue('pt')
    expect(w.emitted('switch')).toEqual([['pt']])
  })

  it('shows the outdated flag + resolve button only for an outdated active translation', async () => {
    const w = mount(TranslationControls, {
      props: { storyLanguage: 'en', translations, current: 'de' },
    })
    expect(w.find('[data-testid="translation-outdated-flag"]').exists()).toBe(false)
    expect(w.find('[data-testid="resolve-translation"]').exists()).toBe(false)
    await w.setProps({ current: 'pt' })
    expect(w.find('[data-testid="translation-outdated-flag"]').exists()).toBe(true)
    await w.find('[data-testid="resolve-translation"]').trigger('click')
    expect(w.emitted('resolve')).toHaveLength(1)
  })

  it('editing the original shows neither flag nor resolve', () => {
    const w = mount(TranslationControls, {
      props: { storyLanguage: 'en', translations, current: '' },
    })
    expect(w.find('[data-testid="translation-outdated-flag"]').exists()).toBe(false)
    expect(w.find('[data-testid="resolve-translation"]').exists()).toBe(false)
  })
})
