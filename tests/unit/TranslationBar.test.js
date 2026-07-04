import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TranslationBar from '../../src/components/TranslationBar.vue'

describe('TranslationBar (story page language switcher)', () => {
  it('hides entirely when the story has no translations', () => {
    const w = mount(TranslationBar, { props: { language: 'en', translations: [] } })
    expect(w.find('[data-testid="translation-bar"]').exists()).toBe(false)
  })

  it('renders one chip per language, original first', () => {
    const w = mount(TranslationBar, {
      props: { language: 'en', translations: [{ lang: 'pt', outdated: false }, { lang: 'hu', outdated: false }] },
    })
    expect(w.find('[data-testid="translation-original"]').text()).toContain('English')
    expect(w.find('[data-testid="translation-chip-pt"]').text()).toContain('Português')
    expect(w.find('[data-testid="translation-chip-hu"]').text()).toContain('Magyar')
  })

  it('emits switch with the lang ("" for original)', async () => {
    const w = mount(TranslationBar, {
      props: { language: 'en', current: 'pt', translations: [{ lang: 'pt', outdated: false }] },
    })
    await w.find('[data-testid="translation-chip-pt"]').trigger('click')
    await w.find('[data-testid="translation-original"]').trigger('click')
    expect(w.emitted('switch')).toEqual([['pt'], ['']])
  })

  it('shows the yellow outdated badge only for the ACTIVE outdated translation', async () => {
    const w = mount(TranslationBar, {
      props: { language: 'en', current: '', translations: [{ lang: 'pt', outdated: true }] },
    })
    // original active -> no badge (but the chip carries a dot marker)
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
