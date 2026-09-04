/**
 * The lobbyist page — the destination for briefing cards that have no
 * company to point at, which is ~4 in 5 of them.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

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
  register_url: 'http://www.janestreet.com/',
  filed_for: [],
}

beforeEach(() => { vi.clearAllMocks(); api.getLobbyist.mockResolvedValue(JANE) })
afterEach(() => vi.restoreAllMocks())

async function mountView(id = '763743132433-49') {
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
    global: { plugins: [router, makeTestI18n()] },
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
})
