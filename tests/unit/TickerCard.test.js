/**
 * A header-search result: an authority named in the reader's language
 * offers the name it published on hover, as translated titles do.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'
import TickerCard from '../../src/components/TickerCard.vue'

const card = (ticker) => mount(TickerCard, {
  props: { ticker: { _type: 'authority', authority_id: 'auth-rsd', _navKey: 'auth-rsd', country: 'CZE', ...ticker } },
  global: { plugins: [makeTestI18n()] },
})

describe('TickerCard', () => {
  it('offers a translated authority\'s published name on hover', () => {
    const w = card({ name: 'Straßen- und Autobahndirektion', name_original: 'Ředitelství silnic a dálnic' })
    const name = w.find('.ticker-name')
    expect(name.text()).toBe('Straßen- und Autobahndirektion')
    expect(name.attributes('title')).toContain('Ředitelství silnic a dálnic')
  })

  it('has nothing to offer for a name shown as published', () => {
    const w = card({ name: 'Ředitelství silnic a dálnic', name_original: null })
    expect(w.find('.ticker-name').attributes('title')).toBeUndefined()
  })
})
