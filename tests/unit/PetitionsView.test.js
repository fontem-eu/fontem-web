/**
 * PetitionsView — curated two-section showcase (Collecting / Reached);
 * PetitionDetailView — legislation buckets.
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
import { useLang } from '../../src/composables/useLang.js'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/petitions', component: PetitionsView },
      { path: '/petitions/:id', component: PetitionDetailView },
    ],
  })
}

// Route the stub by which status set the view asked for.
function stubBySection({ collecting = [], reached = [] }) {
  fetchPetitions.mockImplementation(({ statuses }) => {
    const results = statuses === 'ONGOING' ? collecting : reached
    return Promise.resolve({ counts: {}, total: results.length, results })
  })
}

beforeEach(() => {
  fetchPetitions.mockReset()
  fetchPetitionDetail.mockReset()
})

describe('PetitionsView', () => {
  it('requests both curated sections with the right status sets and sorts', async () => {
    stubBySection({
      collecting: [
        { petition_id: 'ECI(2025)000001', title: 'Ongoing One', status: 'ONGOING', total_supporters: 500000, registration_date: '2025-01-01' },
        { petition_id: 'ECI(2025)000002', title: 'Ongoing Two', status: 'ONGOING', total_supporters: 400000, registration_date: '2025-02-01' },
        { petition_id: 'ECI(2025)000003', title: 'Ongoing Three', status: 'ONGOING', total_supporters: 300000, registration_date: '2025-03-01' },
      ],
      reached: [
        { petition_id: 'ECI(2024)000007', title: 'Stop Destroying Videogames', status: 'ANSWERED', total_supporters: 1294188, registration_date: '2024-06-19' },
      ],
    })
    const router = makeRouter()
    router.push('/petitions')
    await router.isReady()
    const w = mount(PetitionsView, { global: { plugins: [router, makeTestI18n()] } })
    await flushPromises()

    expect(fetchPetitions).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: 'ONGOING', sort: 'supporters', limit: 3, offset: 0 }))
    expect(fetchPetitions).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: 'SUBMITTED,VERIFICATION,ANSWERED', sort: 'recent', limit: 5, offset: 0 }))

    expect(w.text()).toContain('Ongoing One')
    expect(w.text()).toContain('Stop Destroying Videogames')
    // number formatting still applied to the first card's supporter count
    expect(w.find('[data-testid="petition-supporters"]').text()).toContain('500,000')
    // no status filter chips remain
    expect(w.find('[data-testid="petitions-filters"]').exists()).toBe(false)
  })

  it('shows "Show more" for a full page and pages the collecting section', async () => {
    stubBySection({
      collecting: [
        { petition_id: 'ECI(2025)000001', title: 'Ongoing One', status: 'ONGOING', total_supporters: 500000, registration_date: '2025-01-01' },
        { petition_id: 'ECI(2025)000002', title: 'Ongoing Two', status: 'ONGOING', total_supporters: 400000, registration_date: '2025-02-01' },
        { petition_id: 'ECI(2025)000003', title: 'Ongoing Three', status: 'ONGOING', total_supporters: 300000, registration_date: '2025-03-01' },
      ],
      reached: [],
    })
    const router = makeRouter()
    router.push('/petitions')
    await router.isReady()
    const w = mount(PetitionsView, { global: { plugins: [router, makeTestI18n()] } })
    await flushPromises()

    // full page of 3 → collecting offers "Show more"; reached (empty) does not
    const more = w.find('[data-testid="show-more-collecting"]')
    expect(more.exists()).toBe(true)
    expect(w.find('[data-testid="show-more-reached"]').exists()).toBe(false)

    await more.trigger('click')
    await flushPromises()
    expect(fetchPetitions).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: 'ONGOING', sort: 'supporters', limit: 3, offset: 3 }))
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


describe('summaries and languages', () => {
  const VIDEOGAMES = {
    system: 'eu-eci', petition_id: 'ECI(2024)000007', status: 'ANSWERED',
    title: 'Stop à la destruction des jeux vidéo', total_supporters: 1294188,
    summary: "Demande à l'UE de garder jouables les jeux vendus.",
  }

  async function mountDetail(petition) {
    fetchPetitionDetail.mockResolvedValue({ petition, legislation: [], unresolved_answer_refs: [] })
    const router = makeRouter()
    router.push(`/petitions/${encodeURIComponent(petition.petition_id)}`)
    await router.isReady()
    const w = mount(PetitionDetailView, { global: { plugins: [router, makeTestI18n()] } })
    await flushPromises()
    return w
  }

  it('shows each petition\'s summary in the list', async () => {
    stubBySection({ reached: [VIDEOGAMES] })
    const router = makeRouter()
    router.push('/petitions')
    await router.isReady()
    const w = mount(PetitionsView, { global: { plugins: [router, makeTestI18n()] } })
    await flushPromises()
    expect(w.find('[data-testid="petition-summary"]').text()).toBe(VIDEOGAMES.summary)
  })

  it('shows the summary on the petition page, marked as machine-written', async () => {
    const w = await mountDetail({ ...VIDEOGAMES, objectives: 'Obliger les éditeurs…', language_shown: 'fr' })
    const summary = w.find('[data-testid="petition-summary"]')
    expect(summary.text()).toContain(VIDEOGAMES.summary)
    expect(summary.text()).toContain('Summary written by machine')
  })

  it('says so when the register publishes no version in the reader\'s language', async () => {
    useLang().setLang('pl')
    try {
      const w = await mountDetail({ ...VIDEOGAMES, title: 'Stop Destroying Videogames', language_shown: 'en' })
      expect(w.find('[data-testid="petition-not-in-language"]').exists()).toBe(true)
    } finally {
      useLang().setLang('en')
    }
  })

  it('says nothing when the petition is shown in the reader\'s language', async () => {
    useLang().setLang('fr')
    try {
      const w = await mountDetail({ ...VIDEOGAMES, language_shown: 'fr' })
      expect(w.find('[data-testid="petition-not-in-language"]').exists()).toBe(false)
    } finally {
      useLang().setLang('en')
    }
  })

  it('titles the linked legislation as the API names it in the reader\'s language', async () => {
    fetchPetitionDetail.mockResolvedValue({
      petition: { ...VIDEOGAMES, language_shown: 'fr' },
      legislation: [{
        rel: 'REGISTERED_BY', celex: '32024D1824', title_lang: 'fr',
        title: "Décision d'exécution (UE) 2024/1824 de la Commission",
        title_en: 'Commission Implementing Decision (EU) 2024/1824',
        date: '2024-06-17', doc_type: 'Decision',
        eurlex_url: 'https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32024D1824',
      }],
      unresolved_answer_refs: [],
    })
    const router = makeRouter()
    router.push('/petitions/ECI(2024)000007')
    await router.isReady()
    const w = mount(PetitionDetailView, { global: { plugins: [router, makeTestI18n()] } })
    await flushPromises()
    const act = w.find('[data-testid="petition-legislation"] li a')
    expect(act.text()).toBe("Décision d'exécution (UE) 2024/1824 de la Commission")
    expect(act.attributes('lang')).toBe('fr')
    expect(act.attributes('href')).toContain('/FR/TXT/')
  })

  it('says once, in the list, that its summaries are written by machine', async () => {
    stubBySection({ reached: [VIDEOGAMES, { ...VIDEOGAMES, petition_id: 'ECI(2023)000001' }] })
    const router = makeRouter()
    router.push('/petitions')
    await router.isReady()
    const w = mount(PetitionsView, { global: { plugins: [router, makeTestI18n()] } })
    await flushPromises()
    expect(w.findAll('[data-testid="petitions-machine-summary"]')).toHaveLength(1)
    stubBySection({ reached: [{ ...VIDEOGAMES, summary: null }] })
    const none = mount(PetitionsView, { global: { plugins: [router, makeTestI18n()] } })
    await flushPromises()
    expect(none.find('[data-testid="petitions-machine-summary"]').exists()).toBe(false)
  })
})
