import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Wordmark from '../../src/components/Wordmark.vue'

const i18n = { global: { mocks: { $t: (k) => (k === 'wordmark.name' ? 'Dargle' : k) } } }

describe('the Dargle wordmark', () => {
  it('spells DARGLE in three groups', () => {
    const w = mount(Wordmark, i18n)
    expect(w.text()).toBe('DARGLE')
    const spans = w.findAll('span.wordmark-a, span.wordmark-b')
    expect(spans.map((s) => s.text())).toEqual(['D', 'ARG', 'LE'])
  })

  it('gives ARG the second colour and D/LE the first', () => {
    const w = mount(Wordmark, i18n)
    expect(w.findAll('.wordmark-a').map((s) => s.text())).toEqual(['D', 'LE'])
    expect(w.findAll('.wordmark-b').map((s) => s.text())).toEqual(['ARG'])
  })

  it('announces the name once, not letter groups', () => {
    const w = mount(Wordmark, i18n)
    expect(w.attributes('aria-label')).toBe('Dargle')
    expect(w.findAll('[aria-hidden="true"]').length).toBe(3)
  })

  it('does not put the letters through i18n', () => {
    // The previous wordmark translated its first segment, so 23 locales
    // rendered the brand as Шрифт / Písmo / Schriftart.
    const w = mount(Wordmark, { global: { mocks: { $t: () => 'ÜBERSETZT' } } })
    expect(w.text()).toBe('DARGLE')
  })
})
