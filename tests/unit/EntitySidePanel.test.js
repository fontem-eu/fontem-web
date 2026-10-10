/**
 * The side panel a story's entity mention opens: the entity named in the
 * reader's language, with the name it was published under beside it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'
import { useLang } from '../../src/composables/useLang.js'
import EntitySidePanel from '../../src/components/EntitySidePanel.vue'

const IRI = 'http://data.fontem.eu/id/Authority/0b1f5a86-7a39-5b0c-9d2f-4c7e8a4d1e11'
const mockFetch = vi.fn()

function answer(lang) {
  const translated = { de: 'Straßen- und Autobahndirektion', fr: 'Direction des routes et autoroutes' }
  return {
    ok: true,
    json: async () => ({
      iri: IRI, class: 'Authority', facts: [], links: { profile: '/authority/auth-rsd' },
      label: translated[lang] || 'Ředitelství silnic a dálnic',
      label_original: translated[lang] ? 'Ředitelství silnic a dálnic' : null,
    }),
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  mockFetch.mockImplementation(async (url) => answer(new URL(url, 'http://x').searchParams.get('lang')))
})
afterEach(() => {
  useLang().setLang('en')
  vi.unstubAllGlobals()
})

async function openOn(iri) {
  const w = mount(EntitySidePanel, { global: { plugins: [makeTestI18n()] }, attachTo: document.body })
  document.dispatchEvent(new CustomEvent('entity-mention-click', { detail: { iri } }))
  await flushPromises()
  return w
}

describe('EntitySidePanel', () => {
  it('names a mentioned authority in the reader\'s language, its published name beside it', async () => {
    useLang().setLang('de')
    const w = await openOn(IRI)
    expect(mockFetch.mock.calls[0][0]).toMatch(/[?&]lang=de/)
    expect(w.find('[data-testid="entity-side-panel-label"]').text()).toBe('Straßen- und Autobahndirektion')
    expect(w.find('[data-testid="entity-side-panel-original"]').text()).toContain('Ředitelství silnic a dálnic')
    w.unmount()
  })

  it('asks again when the reader changes language while it is open', async () => {
    useLang().setLang('de')
    const w = await openOn(IRI)
    useLang().setLang('fr')
    await flushPromises()
    expect(w.find('[data-testid="entity-side-panel-label"]').text()).toBe('Direction des routes et autoroutes')
    w.unmount()
  })

  it('shows no original when the name is shown as published', async () => {
    useLang().setLang('pl')
    const w = await openOn(IRI)
    expect(w.find('[data-testid="entity-side-panel-label"]').text()).toBe('Ředitelství silnic a dálnic')
    expect(w.find('[data-testid="entity-side-panel-original"]').exists()).toBe(false)
    w.unmount()
  })
})
