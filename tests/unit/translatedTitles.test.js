/**
 * Contract and cohesion-grant titles in the reader's language.
 *
 * The API returns a title translated into the UI language when a machine
 * translation exists (else the original), with the original beside it as
 * `title_original` (briefing items: `facets.headline_original`). Every
 * surface asks in the reader's language, re-asks when it changes, and
 * keeps the original within reach: a tooltip on lists and cards, a line
 * under the heading on the contract page.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
import { useLang } from '../../src/composables/useLang.js'
import ContractsPanel from '../../src/components/ContractsPanel.vue'
import CohesionGrantsPanel from '../../src/components/CohesionGrantsPanel.vue'
import ContractDetailView from '../../src/views/ContractDetailView.vue'
import BriefingCard from '../../src/components/BriefingCard.vue'
import FeedView from '../../src/views/FeedView.vue'
import TickerFinancials from '../../src/components/TickerFinancials.vue'
import * as briefings from '../../src/composables/useBriefingStream.js'

// FeedView's sources, mocked as FeedView.test.js does.
vi.mock('../../src/api/community.js', () => ({
  listReports: vi.fn(() => Promise.resolve([])),
  listAllTags: vi.fn(() => Promise.resolve({ tags: [] })),
  listFollowedTags: vi.fn(() => Promise.resolve({ tags: [] })),
  followTag: vi.fn(), unfollowTag: vi.fn(),
}))
vi.mock('../../src/composables/useBriefingStream.js', () => ({
  loadBriefingStream: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../../src/api/nuts.js', () => ({
  fetchNutsRegions: vi.fn(() => Promise.resolve({ regions: [] })),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// A mounted panel follows the UI language; one left over from the previous
// test would refetch when this one sets it.
enableAutoUnmount(afterEach)

// Set before each test only: changing it after one would reach components
// auto-unmount has not removed yet.
const { lang } = useLang()
beforeEach(() => { vi.clearAllMocks(); mockFetch.mockReset(); lang.value = 'en' })

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const urls = () => mockFetch.mock.calls.map((c) => String(c[0]))

function router() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/contract/:noticeId', component: ContractDetailView },
      { path: '/c/:id/profile', component: { template: '<div />' } },
      { path: '/company/:gmr_id', component: { template: '<div />' } },
      { path: '/authority/:authority_id', component: { template: '<div />' } },
      { path: '/spending', component: { template: '<div />' } },
    ],
  })
}

const CZ = 'Léčivý přípravek ZANUBRUTINIB'
const EN = 'Medicinal product ZANUBRUTINIB'

describe('contract lists (company and authority pages)', () => {
  const list = (contracts) => ok({
    gmr_id: '11111111-2222-3333-4444-555555555555', company_name: 'Acme', country: 'CZE',
    contract_count: contracts.length, total_contract_value_eur: 1, contracts,
  })
  const row = (extra) => ({
    ted_notice_id: 'n1', value_eur: 1, award_date: '2026-01-01', cpv: '33',
    procedure_type: 'open', authority: 'Nemocnice', authority_id: 'a1', ...extra,
  })

  async function panel() {
    const w = mount(ContractsPanel, {
      props: { symbol: '11111111-2222-3333-4444-555555555555' },
      global: { plugins: [makeTestI18n(), router()] },
    })
    await flushPromises()
    return w
  }

  it('asks in the reader\'s language and keeps the original on hover', async () => {
    mockFetch.mockResolvedValue(list([row({ title: EN, title_original: CZ })]))
    const w = await panel()
    expect(urls()[0]).toMatch(/\/contracts\?limit=100&sort=recent&lang=en$/)
    const title = w.find('[data-testid="contract-title-link-n1"]')
    expect(title.text()).toBe(EN)
    expect(title.attributes('title')).toBe(`Machine translation. Original title: ${CZ}`)
  })

  it('an untranslated title has no hint', async () => {
    mockFetch.mockResolvedValue(list([row({ title: CZ, title_original: null })]))
    const w = await panel()
    expect(w.find('[data-testid="contract-title-link-n1"]').attributes('title')).toBeUndefined()
  })

  it('a new UI language asks again, in that language', async () => {
    mockFetch.mockResolvedValue(list([row({ title: EN, title_original: CZ })]))
    await panel()
    lang.value = 'de'
    await nextTick()
    await flushPromises()
    expect(urls().at(-1)).toMatch(/lang=de$/)
  })
})

describe('cohesion grants (company page)', () => {
  it('asks in the reader\'s language and keeps the original on hover', async () => {
    mockFetch.mockResolvedValue(ok({
      gmr_id: 'g1', grant_count: 1, total_eu_contribution: 5,
      grants: [{ title: 'Ausbau des Hafens', title_original: 'Upgrading of the port',
        fund: 'ERDF', eu_contribution: 5, year: 2024 }],
    }))
    lang.value = 'de'
    const w = mount(CohesionGrantsPanel, { props: { gmrId: 'g1' }, global: { plugins: [makeTestI18n()] } })
    await flushPromises()
    expect(urls()[0]).toBe('/api/companies/g1/cohesion-grants?limit=100&lang=de')
    const cell = w.find('.cg-title')
    expect(cell.text()).toBe('Ausbau des Hafens')
    expect(cell.attributes('title')).toContain('Upgrading of the port')
  })
})

describe('the contract page', () => {
  async function page(body) {
    mockFetch.mockResolvedValue(ok({
      ted_notice_id: 'n1', value_eur: 1, integrity: {},
      authority: { authority_id: 'a1', name: 'Nemocnice' }, contractor: null, ...body,
    }))
    const r = router()
    r.push('/contract/n1')
    await r.isReady()
    const w = mount(ContractDetailView, {
      global: { plugins: [makeTestI18n(), r], stubs: { ThemeToggle: true } },
    })
    await flushPromises()
    return w
  }

  it('shows the translation, and the original one line below it', async () => {
    const w = await page({ title: EN, title_original: CZ, title_lang: 'cs' })
    expect(urls()[0]).toBe('/api/contracts/n1?lang=en')
    expect(w.find('[data-testid="contract-title"]').text()).toBe(EN)
    const original = w.find('[data-testid="contract-title-original"]')
    expect(original.text()).toBe(`Original title (CS): ${CZ}`)
    expect(original.find('[lang="cs"]').text()).toBe(CZ)
  })

  it('an untranslated title is shown alone', async () => {
    const w = await page({ title: CZ, title_original: null, title_lang: 'cs' })
    expect(w.find('[data-testid="contract-title"]').text()).toBe(CZ)
    expect(w.find('[data-testid="contract-title-original"]').exists()).toBe(false)
  })
})

describe('briefing cards', () => {
  const card = (facets) => mount(BriefingCard, {
    props: { item: { item_id: 'c1', _from: 'Public investment', _group: 'public-investment',
      _link: { kind: 'none' }, summary: facets.headline, facets } },
    global: { plugins: [router(), makeTestI18n()] },
  })

  it('keeps the original headline on hover when it was translated', () => {
    const w = card({ kind: 'contract', headline: EN, headline_original: CZ })
    const what = w.find('[data-testid="feed-briefing-what-c1"]')
    expect(what.text()).toBe(EN)
    expect(what.attributes('title')).toBe(`Machine translation. Original title: ${CZ}`)
  })

  it('an untranslated headline has no hint', () => {
    const w = card({ kind: 'contract', headline: CZ })
    expect(w.find('[data-testid="feed-briefing-what-c1"]').attributes('title')).toBeUndefined()
  })
})

describe('the feed', () => {
  // Briefing headlines come back translated for the reader's language, so a
  // switch must fetch them again. loadBriefings keeps what it loaded, and
  // used to answer the switch with the previous language's items.
  it('fetches the briefings again when the UI language changes', async () => {
    const r = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/feed', component: FeedView }, { path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    r.push('/feed')
    await r.isReady()
    mount(FeedView, { global: { plugins: [r, makeTestI18n()] } })
    await flushPromises()
    expect(briefings.loadBriefingStream).toHaveBeenCalledTimes(1)
    lang.value = 'de'
    await flushPromises()
    expect(briefings.loadBriefingStream).toHaveBeenCalledTimes(2)
  })
})

describe('an authority\'s page heading', () => {
  // The heading comes from the authority's profile, which the page used to
  // ask for without a language: the name stayed in the original even where
  // a translation exists (Ředitelství silnic a dálnic s. p. in a German UI).
  const ID = '07f593b2-7c4c-536f-852a-d886502e71f0'
  const NAMES = { de: 'Straßen- und Autobahndirektion, ö. U.', en: 'Road and Motorway Directorate' }

  function api() {
    mockFetch.mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('/api/companies/')) return ok({ gmr_id: ID, company_name: null })
      if (u.includes('/api/authorities/')) {
        const code = new URL(u, 'http://x').searchParams.get('lang')
        return ok({ authority_id: ID, authority_name: NAMES[code] || 'Ředitelství silnic a dálnic s. p.' })
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' }
    })
  }

  it('is asked for in the reader\'s language and shows the translated name', async () => {
    api()
    lang.value = 'de'
    const w = mount(TickerFinancials, { props: { symbol: ID, view: 'summary' } })
    await flushPromises()
    expect(urls()).toContain(`/api/authorities/${ID}?lang=de`)
    expect(w.find('[data-testid="financials-title"]').text()).toBe(NAMES.de)
  })

  it('follows a change of UI language', async () => {
    api()
    lang.value = 'de'
    const w = mount(TickerFinancials, { props: { symbol: ID, view: 'summary' } })
    await flushPromises()
    lang.value = 'en'
    await flushPromises()
    expect(w.find('[data-testid="financials-title"]').text()).toBe(NAMES.en)
  })
})
