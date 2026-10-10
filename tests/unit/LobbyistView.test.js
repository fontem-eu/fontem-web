/**
 * The lobbyist page — the destination for briefing cards that have no
 * company to point at, which is ~4 in 5 of them.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { makeTestI18n } from './helpers/i18n.js'
import en from '../../src/locales/en.json'
import fr from '../../src/locales/fr.json'

vi.mock('../../src/api/lobbyists.js', () => ({ getLobbyist: vi.fn() }))

import * as api from '../../src/api/lobbyists.js'
import LobbyistView from '../../src/views/LobbyistView.vue'

const JANE = {
  disclosure_id: '763743132433-49',
  name: 'Jane Street Group',
  acronym: null,
  category: 'Companies & groups',
  entity_form: null,
  country: 'UNITED STATES',
  city: null,
  website: 'http://www.janestreet.com/',
  goals: null,
  interests: null,
  declared_spend: { min_eur: 10000, max_eur: 24999, currency: 'EUR' },
  members_fte: 0.3,
  registered_on: '2021-03-04',
  last_updated: '2026-08-14',
  active: true,
  register_url: 'https://transparency-register.europa.eu/search-register-or-update/organisation-detail_en?id=763743132433-49',
  filed_for: [],
}

beforeEach(() => { vi.clearAllMocks(); api.getLobbyist.mockResolvedValue(JANE) })
afterEach(() => vi.restoreAllMocks())

// A reader of the French page.
const french = () => createI18n({
  legacy: false, locale: 'fr', fallbackLocale: 'en', messages: { en, fr },
  missingWarn: false, fallbackWarn: false,
})

async function mountView(id = '763743132433-49', i18n = makeTestI18n()) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/lobbyist/:disclosureId', component: LobbyistView },
      { path: '/company/:gmr_id', component: { template: '<div />' } },
    ],
  })
  await router.push(`/lobbyist/${id}`)
  await router.isReady()
  const wrapper = mount(LobbyistView, {
    global: { plugins: [router, i18n] },
  })
  await flushPromises()
  return wrapper
}

describe('LobbyistView', () => {
  it('shows the registrant', async () => {
    const w = await mountView()
    expect(w.find('[data-testid="lobbyist-name"]').text()).toContain('Jane Street Group')
  })

  it('renders the declared spend as the band the register recorded', async () => {
    // A single figure would claim a precision the source does not have.
    const w = await mountView()
    const spend = w.find('[data-testid="lobbyist-fact-spend"]').text()
    expect(spend).toContain('–')
    // Exact, not abbreviated: the register's bands are contiguous
    // (…–24,999 then 25,000–…), so rounding 24,999 to "25K" makes the
    // top of one band read as the bottom of the next.
    expect(spend.replace(/[^0-9]/g, '')).toContain('24999')
    expect(spend).not.toMatch(/25K/i)
  })

  it('still shows a half-open band', async () => {
    api.getLobbyist.mockResolvedValue({
      ...JANE, declared_spend: { min_eur: 10000000, max_eur: null, currency: 'EUR' },
    })
    const w = await mountView()
    const spend = w.find('[data-testid="lobbyist-fact-spend"]')
    expect(spend.exists()).toBe(true)
    expect(spend.text()).not.toContain('–')
  })

  it('omits a fact rather than showing an empty row', async () => {
    // city is null on this registrant.
    const w = await mountView()
    expect(w.find('[data-testid="lobbyist-fact-city"]').exists()).toBe(false)
    expect(w.find('[data-testid="lobbyist-fact-country"]').exists()).toBe(true)
  })

  it('links a resolved filer to its company page', async () => {
    api.getLobbyist.mockResolvedValue({
      ...JANE,
      filed_for: [{ label: 'Company', name: 'Jane Street Europe', profile: '/company/abc-123' }],
    })
    const w = await mountView()
    const link = w.find('[data-testid="lobbyist-filer-link"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/company/abc-123')
  })

  it('says so plainly when nothing is linked', async () => {
    // The common case. A reader should be able to tell "no link on
    // record" from "we did not look".
    const w = await mountView()
    expect(w.find('[data-testid="lobbyist-filed-for"]').exists()).toBe(true)
    expect(w.find('[data-testid="lobbyist-filer-link"]').exists()).toBe(false)
  })

  it('does not offer a dead link for an unresolved filer', async () => {
    api.getLobbyist.mockResolvedValue({
      ...JANE, filed_for: [{ label: 'Company', name: 'Unresolved Ltd', profile: null }],
    })
    const w = await mountView()
    expect(w.text()).toContain('Unresolved Ltd')
    expect(w.find('[data-testid="lobbyist-filer-link"]').exists()).toBe(false)
  })

  it('reports a missing registrant rather than rendering an empty page', async () => {
    api.getLobbyist.mockRejectedValue(new Error('HTTP 404: not found'))
    const w = await mountView('nope')
    expect(w.find('[data-testid="lobbyist-not-found"]').exists()).toBe(true)
  })

  it('marks outbound links nofollow', async () => {
    // These are self-declared destinations from a public register; we
    // link them for the reader, we do not vouch for them.
    const w = await mountView()
    const rel = w.find('[data-testid="lobbyist-website"]').attributes('rel')
    expect(rel).toContain('nofollow')
    expect(rel).toContain('noopener')
  })

  it('opens the register entry the API names, not the organisation\'s website', async () => {
    // Regression: the "register entry" link opened janestreet.com.
    const w = await mountView()
    expect(w.find('[data-testid="lobbyist-register"]').attributes('href')).toBe(JANE.register_url)
    expect(w.find('[data-testid="lobbyist-website"]').attributes('href')).toBe(JANE.website)
  })

  it('lists the interests one by one', async () => {
    // They are a list; the page printed the raw array.
    api.getLobbyist.mockResolvedValue({ ...JANE, interests: ['Banking and financial services', 'Taxation'] })
    const w = await mountView()
    const items = w.findAll('[data-testid="lobbyist-interests"] li').map((li) => li.text())
    expect(items).toEqual(['Banking and financial services', 'Taxation'])
    expect(w.text()).not.toContain('["')
  })

  const BRAUER = {
    ...JANE,
    disclosure_id: '9218245390-27',
    name: 'Beispiel Brauer-Bund e.V.',
    goals: 'Representing the interests of the German brewing industry.',
    goals_original: 'Die Interessen der deutschen Brauwirtschaft vertreten.',
    goals_lang: 'de',
    goals_translated: true,
    goals_summary: 'Represents the German brewing industry at the EU.',
  }

  it('shows the summary first, marked as machine-written', async () => {
    api.getLobbyist.mockResolvedValue(BRAUER)
    const w = await mountView('9218245390-27')
    const summary = w.find('[data-testid="lobbyist-summary"]')
    expect(summary.text()).toContain('Represents the German brewing industry at the EU.')
    expect(summary.text()).toContain('Summary written by machine')
  })

  it('shows translated goals with the original one click away', async () => {
    api.getLobbyist.mockResolvedValue(BRAUER)
    const w = await mountView('9218245390-27')
    expect(w.find('[data-testid="lobbyist-goals-text"]').text()).toBe(BRAUER.goals)
    expect(w.find('[data-testid="lobbyist-goals-note"]').text()).toContain('Machine translation (original: DE)')
    await w.find('[data-testid="lobbyist-goals-toggle"]').trigger('click')
    const original = w.find('[data-testid="lobbyist-goals-original"]')
    expect(original.text()).toBe(BRAUER.goals_original)
    expect(original.attributes('lang')).toBe('de')
    expect(w.find('[data-testid="lobbyist-goals-toggle"]').text()).toBe('Hide original')
  })

  it('shows goals as written, with no note, when nothing is translated', async () => {
    api.getLobbyist.mockResolvedValue({ ...BRAUER, goals: BRAUER.goals_original, goals_translated: false,
                                        goals_summary: null })
    const w = await mountView('9218245390-27')
    expect(w.find('[data-testid="lobbyist-goals-text"]').text()).toBe(BRAUER.goals_original)
    expect(w.find('[data-testid="lobbyist-goals-note"]').exists()).toBe(false)
    expect(w.find('[data-testid="lobbyist-summary"]').exists()).toBe(false)
  })

  // The register's fixed vocabularies, and a country by its code.
  const IN_FRENCH = {
    ...BRAUER, category: 'Trade and business associations', country: 'GERMANY',
    country_code: 'DE', interests: ['Environment', 'Climate action', 'A heading the register added later'],
    goals_summary_lang: 'de',
  }

  it('names the category and interest areas in the reader\'s language', async () => {
    api.getLobbyist.mockResolvedValue(IN_FRENCH)
    const w = await mountView('9218245390-27', french())
    expect(w.find('[data-testid="lobbyist-fact-category"]').text()).toBe(
      fr.lobbyist.category_values.trade_and_business_associations)
    const items = w.findAll('[data-testid="lobbyist-interests"] li').map((li) => li.text())
    expect(items).toEqual([fr.lobbyist.interest_values.environment,
      fr.lobbyist.interest_values.climate_action, 'A heading the register added later'])
  })

  it('names the country in the reader\'s language from its code', async () => {
    api.getLobbyist.mockResolvedValue(IN_FRENCH)
    const w = await mountView('9218245390-27', french())
    expect(w.find('[data-testid="lobbyist-fact-country"]').text()).toBe('Allemagne')
    api.getLobbyist.mockResolvedValue({ ...IN_FRENCH, country_code: null })
    const without = await mountView('9218245390-27', french())
    expect(without.find('[data-testid="lobbyist-fact-country"]').text()).toBe('GERMANY')
  })

  it('says when the summary is not in the reader\'s language, and in which it is', async () => {
    api.getLobbyist.mockResolvedValue(IN_FRENCH)
    const w = await mountView('9218245390-27', french())
    expect(w.find('[data-testid="lobbyist-summary-lang"]').text()).toBe('Résumé en allemand')
    api.getLobbyist.mockResolvedValue({ ...IN_FRENCH, goals_summary_lang: 'fr' })
    const inFrench = await mountView('9218245390-27', french())
    expect(inFrench.find('[data-testid="lobbyist-summary-lang"]').exists()).toBe(false)
  })
})
