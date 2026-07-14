/**
 * PetitionsView — list + status filter; PetitionDetailView — legislation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

const fetchPetitions = vi.fn()
const fetchPetitionDetail = vi.fn()

vi.mock('../../src/api/petitions.js', () => ({
  fetchPetitions: (...a) => fetchPetitions(...a),
  fetchPetitionDetail: (...a) => fetchPetitionDetail(...a),
}))

import PetitionsView from '../../src/views/PetitionsView.vue'
import PetitionDetailView from '../../src/views/PetitionDetailView.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/petitions', component: PetitionsView },
      { path: '/petitions/:id', component: PetitionDetailView },
    ],
  })
}

beforeEach(() => {
  fetchPetitions.mockReset()
  fetchPetitionDetail.mockReset()
})

describe('PetitionsView', () => {
  it('renders cards, counts and filters by status', async () => {
    fetchPetitions.mockResolvedValue({
      counts: { ANSWERED: 14, REGISTERED: 40 },
      total: 54,
      results: [{
        petition_id: 'ECI(2024)000007', title: 'Stop Destroying Videogames',
        status: 'ANSWERED', total_supporters: 1294188,
        registration_date: '2024-06-19',
      }],
    })
    const router = makeRouter()
    router.push('/petitions')
    await router.isReady()
    const w = mount(PetitionsView, { global: { plugins: [router, makeTestI18n()] } })
    await flushPromises()
    expect(w.text()).toContain('Stop Destroying Videogames')
    expect(w.find('[data-testid="petition-supporters"]').text()).toContain('1,294,188')
    expect(w.find('[data-testid="filter-ANSWERED"]').exists()).toBe(true)

    await w.find('[data-testid="filter-ANSWERED"]').trigger('click')
    await flushPromises()
    expect(fetchPetitions).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'ANSWERED' }))
  })
})

describe('PetitionDetailView', () => {
  it('shows objectives, supporters and legislation buckets', async () => {
    fetchPetitionDetail.mockResolvedValue({
      petition: {
        petition_id: 'ECI(2024)000007', title: 'Stop Destroying Videogames',
        status: 'ANSWERED', total_supporters: 1294188,
        objectives: 'Protect purchased videogames from remote disabling.',
        registration_date: '2024-06-19', answered_date: '2026-06-16',
        organizer_names: ['Daniel ONDRUSKA'], organizer_roles: ['REPRESENTATIVE'],
        answer_refs: ['C(2026)4110'],
      },
      legislation: [{
        rel: 'REGISTERED_BY', celex: '32024D1824',
        title_en: 'Commission Implementing Decision (EU) 2024/1824',
        date: '2024-06-17', doc_type: 'Decision',
        eurlex_url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024D1824',
      }],
      unresolved_answer_refs: ['C(2026)4110'],
    })
    const router = makeRouter()
    router.push('/petitions/ECI(2024)000007')
    await router.isReady()
    const w = mount(PetitionDetailView, { global: { plugins: [router, makeTestI18n()] } })
    await flushPromises()
    expect(w.text()).toContain('Protect purchased videogames')
    expect(w.find('[data-testid="petition-supporters-hero"]').text()).toContain('1,294,188')
    const leg = w.find('[data-testid="petition-legislation"]')
    expect(leg.text()).toContain('Commission Implementing Decision (EU) 2024/1824')
    expect(w.find('[data-testid="unresolved-refs"]').text()).toContain('C(2026)4110')
  })
})
