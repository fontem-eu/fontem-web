import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, createWebHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'
import ContractDetailView from '../../src/views/ContractDetailView.vue'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
afterEach(() => { mockFetch.mockReset() })

async function mountAt(noticeId) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/contract/:noticeId', component: ContractDetailView },
      { path: '/spending', component: { template: '<div />' } },
      { path: '/company/:gmr_id', component: { template: '<div />' } },
      { path: '/authority/:authority_id', component: { template: '<div />' } },
    ],
  })
  router.push(`/contract/${noticeId}`)
  await router.isReady()
  const wrapper = mount(ContractDetailView, {
    global: { plugins: [makeTestI18n(), router], stubs: { ThemeToggle: true } },
  })
  await flushPromises()
  return wrapper
}

describe('ContractDetailView — both sides of the contract are reachable', () => {
  const detail = (authority) => ({
    ok: true,
    json: async () => ({
      ted_notice_id: '123-2024', title: 'Books supply', value_eur: 500000,
      authority,
      contractor: { gmr_id: 'g1', name: 'Acme' },
      integrity: {},
    }),
  })

  it('links the buyer, like it already links the supplier', async () => {
    // The page could name the buyer but not reach it, while the supplier
    // beside it was clickable.
    mockFetch.mockResolvedValueOnce(detail(
      { authority_id: 'a-77', name: 'City of Y', country: 'HUN' }))
    const wrapper = await mountAt('123-2024')
    const link = wrapper.find('[data-testid="contract-authority-link"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/authority/a-77')
    expect(link.text()).toBe('City of Y')
  })

  it('still shows the country beside the linked name', async () => {
    mockFetch.mockResolvedValueOnce(detail(
      { authority_id: 'a-77', name: 'City of Y', country: 'HUN' }))
    const wrapper = await mountAt('123-2024')
    expect(wrapper.text()).toContain('City of Y')
    expect(wrapper.text()).toContain('(HUN)')
  })

  it('leaves a buyer with no id as plain text, not a dead click', async () => {
    mockFetch.mockResolvedValueOnce(detail({ name: 'City of Y', country: 'HUN' }))
    const wrapper = await mountAt('123-2024')
    expect(wrapper.find('[data-testid="contract-authority-link"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('City of Y')
  })
})

/**
 * Data-backlog Part 5, C2: the cleaning stage mints no company when the
 * supplier name field holds a sentence, a web address or a placeholder.
 * The contract then has no contractor to link, and the cell used to be
 * empty — the page looked as if it had lost the supplier. The notice did
 * publish something, so the page says "not disclosed" and shows it.
 */
describe('ContractDetailView — a supplier the notice did not disclose', () => {
  const DECREE = 'Gara aggiudicata come da determina n. 543 del 2013 pubblicata sul sito www.csc.sanita.fvg.it'
  const detail = (extra) => ({
    ok: true,
    json: async () => ({
      ted_notice_id: '184512-2013', title: 'Servizi', value_eur: 12000,
      authority: { authority_id: 'a-1', name: 'ASS 3 Alto Friuli', country: 'ITA' },
      contractor: null, integrity: {}, suppliers_withheld: [],
      ...extra,
    }),
  })

  it('labels the contractor cell instead of leaving it empty', async () => {
    mockFetch.mockResolvedValueOnce(detail({
      suppliers_withheld: [{ name_raw: DECREE, reason: 'it.notice_text_in_supplier_name' }],
      supplier_not_disclosed: true,
    }))
    const wrapper = await mountAt('184512-2013')
    const cell = wrapper.find('[data-testid="supplier-not-disclosed"]')
    expect(cell.exists()).toBe(true)
    expect(cell.text()).toContain('Supplier not disclosed in the notice')
    expect(wrapper.find('a[href^="/company/"]').exists()).toBe(false)
  })

  it('shows the published text and why it was not taken for a name', async () => {
    mockFetch.mockResolvedValueOnce(detail({
      suppliers_withheld: [
        { name_raw: DECREE, reason: 'it.notice_text_in_supplier_name' },
        { name_raw: 'www.example.it', reason: 'generic.name_contains_url' },
      ],
    }))
    const wrapper = await mountAt('184512-2013')
    const cell = wrapper.find('[data-testid="supplier-not-disclosed"]')
    expect(cell.find('summary').attributes('title')).toBe(DECREE)
    expect(cell.find('[data-testid="withheld-supplier-0"]').text()).toContain(DECREE)
    expect(cell.find('[data-testid="withheld-supplier-0"]').text()).toContain('Notice text in the name field')
    expect(cell.find('[data-testid="withheld-supplier-1"]').text()).toContain('www.example.it')
    expect(cell.find('[data-testid="withheld-supplier-1"]').text()).toContain('A web address instead of a name')
  })

  it('explains a rule it has no words for in generic terms, never as a raw id', async () => {
    mockFetch.mockResolvedValueOnce(detail({
      suppliers_withheld: [{ name_raw: 'n/a', reason: 'pt.some_future_rule' }, { name_raw: '-', reason: null }],
    }))
    const wrapper = await mountAt('184512-2013')
    const cell = wrapper.find('[data-testid="supplier-not-disclosed"]')
    expect(cell.text()).not.toContain('pt.some_future_rule')
    expect(cell.find('[data-testid="withheld-supplier-0"]').text()).toContain('Not a company name')
    expect(cell.find('[data-testid="withheld-supplier-1"]').text()).toContain('Not a company name')
  })

  it('shows a dash, like the other cells, when nothing was withheld either', async () => {
    // A contract from before the cleaning stage with no supplier on
    // record: that is not "not disclosed", it is simply not there.
    mockFetch.mockResolvedValueOnce(detail({}))
    const wrapper = await mountAt('184512-2013')
    expect(wrapper.find('[data-testid="supplier-not-disclosed"]').exists()).toBe(false)
    const dd = wrapper.findAll('dd').find((el) => el.text() === '—' && el.element.previousElementSibling?.textContent === 'Contractor')
    expect(dd).toBeDefined()
  })

  it('links the named supplier when one was named, even if another was withheld', async () => {
    mockFetch.mockResolvedValueOnce(detail({
      contractor: { gmr_id: 'g1', name: 'Acme S.p.A.' },
      suppliers_withheld: [{ name_raw: 'diversi', reason: 'generic.name_is_placeholder' }],
    }))
    const wrapper = await mountAt('184512-2013')
    expect(wrapper.find('[data-testid="supplier-not-disclosed"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/company/g1"]').text()).toBe('Acme S.p.A.')
  })

  it('keeps the smoke-test anchors of the page', async () => {
    mockFetch.mockResolvedValueOnce(detail({
      ted_publication_number: '184512-2013',
      suppliers_withheld: [{ name_raw: DECREE, reason: 'it.notice_text_in_supplier_name' }],
    }))
    const wrapper = await mountAt('184512-2013')
    for (const id of ['contract-detail', 'integrity-profile', 'red-flag-count', 'ted-outlink']) {
      expect(wrapper.find(`[data-testid="${id}"]`).exists(), id).toBe(true)
    }
  })
})

describe('ContractDetailView', () => {
  it('renders the integrity red flags, bidder count and outward TED link', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ted_notice_id: '123-2024',
        title: 'Books supply',
        value_eur: 500000,
        ted_publication_number: '295342-2026',
        authority: { name: 'City', country: 'HUN' },
        contractor: { gmr_id: 'g1', name: 'Acme' },
        integrity: {
          procedure_type: 'neg-wo-call', tenders_received: 1,
          award_criterion_type: 'price', is_single_bidder: true,
          is_non_open: true, is_no_call: true, is_price_only: true,
          integrity_red_flags: 4,
        },
      }),
    })
    const wrapper = await mountAt('123-2024')
    expect(wrapper.find('[data-testid="contract-detail"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="red-flag-count"]').text()).toContain('4')
    expect(wrapper.find('[data-testid="flag-is_single_bidder"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bidder-count"]').text()).toContain('1')
    const ted = wrapper.find('[data-testid="ted-outlink"]')
    expect(ted.exists()).toBe(true)
    expect(ted.attributes('href')).toContain('ted.europa.eu')
    expect(ted.attributes('target')).toBe('_blank')
  })

  it('shows a not-found state for a 404', async () => {
    mockFetch.mockResolvedValueOnce({ status: 404, ok: false })
    const wrapper = await mountAt('nope')
    expect(wrapper.find('[data-testid="contract-notfound"]').exists()).toBe(true)
  })
})

/**
 * The reported bug: reading the mixed feed, opening a briefing's
 * contract, pressing the back arrow — and landing on Public spending
 * instead of the feed. The arrow was a hardcoded RouterLink to
 * /spending, so it ignored where the reader came from, and being a push
 * it drove the real previous page one entry further away each time.
 *
 * These use a real web history, because that is the only implementation
 * that records the previous entry: `buildState` lives in vue-router's
 * `useHistoryStateNavigation`, so a memory history reports `state` as
 * `{}` and could never exercise the path being fixed.
 */
describe('ContractDetailView — the back arrow goes back', () => {
  const ROUTES = [
    { path: '/', component: { template: '<div />' } },
    { path: '/briefings', component: { template: '<div />' } },
    { path: '/contract/:noticeId', component: ContractDetailView },
    { path: '/spending', component: { template: '<div />' } },
    { path: '/company/:gmr_id', component: { template: '<div />' } },
    { path: '/authority/:authority_id', component: { template: '<div />' } },
  ]

  // jsdom shares one URL across tests; leaving a deep path behind would
  // change where the next router thinks it started.
  afterEach(() => { window.history.replaceState(null, '', '/') })

  async function mountWith(router) {
    await router.isReady()
    const wrapper = mount(ContractDetailView, {
      global: { plugins: [makeTestI18n(), router], stubs: { ThemeToggle: true } },
    })
    await flushPromises()
    return wrapper
  }

  async function arriveFrom(feedPath) {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    const router = createRouter({ history: createWebHistory(), routes: ROUTES })
    await router.push(feedPath)
    await router.push('/contract/n-1')
    return { wrapper: await mountWith(router), router }
  }

  it('returns to the mixed feed when that is where the reader came from', async () => {
    // back() is stubbed rather than called through: a real history.go(-1)
    // is "Not implemented" in jsdom and only adds noise. What is being
    // pinned is that the arrow pops the entry instead of pushing a page.
    const { wrapper, router } = await arriveFrom('/')
    const back = vi.spyOn(router, 'back').mockImplementation(() => {})
    const push = vi.spyOn(router, 'push')

    await wrapper.get('[data-testid="contract-back"]').trigger('click')

    expect(back).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
  })

  it('returns to the briefings feed when that is where the reader came from', async () => {
    const { wrapper, router } = await arriveFrom('/briefings')
    const back = vi.spyOn(router, 'back').mockImplementation(() => {})

    await wrapper.get('[data-testid="contract-back"]').trigger('click')

    expect(back).toHaveBeenCalledTimes(1)
  })

  it('labels the arrow "back", not the fallback page, when it will go back', async () => {
    const { wrapper } = await arriveFrom('/')

    expect(wrapper.get('[data-testid="contract-back"]').text()).toContain('Back')
  })

  it('falls back to public spending on a cold deep link', async () => {
    // A shared contract URL opened in a fresh tab. A memory history is
    // used purely to arrange that precondition: it reports no previous
    // entry, which is exactly the cold-start condition. This is the one
    // case the old hardcoded link got right, and it still holds.
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    const router = createRouter({ history: createMemoryHistory(), routes: ROUTES })
    await router.push('/contract/n-1')
    const wrapper = await mountWith(router)
    const push = vi.spyOn(router, 'push')
    const back = vi.spyOn(router, 'back').mockImplementation(() => {})

    await wrapper.get('[data-testid="contract-back"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/spending')
    expect(back).not.toHaveBeenCalled()
  })

  it('keeps a real href so the link can still be opened in a new tab', async () => {
    const { wrapper } = await arriveFrom('/')

    expect(wrapper.get('[data-testid="contract-back"]').attributes('href')).toBe('/spending')
  })

  it('leaves a ctrl/cmd-click to the browser instead of navigating in place', async () => {
    const { wrapper, router } = await arriveFrom('/')
    const back = vi.spyOn(router, 'back').mockImplementation(() => {})
    const link = wrapper.get('[data-testid="contract-back"]')

    // A second listener on the same element, registered after the
    // component's, so it runs immediately after it: it records whether
    // the handler cancelled the event, then cancels it so jsdom never
    // schedules the anchor's real navigation (which it cannot perform
    // and reports as an unhandled error). Declining to intercept is the
    // behaviour under test, so it has to be observed, not suppressed.
    const prevented = []
    link.element.addEventListener('click', (event) => {
      prevented.push(event.defaultPrevented)
      event.preventDefault()
    })

    await link.trigger('click', { ctrlKey: true })

    expect(prevented).toEqual([false])
    expect(back).not.toHaveBeenCalled()
  })
})

/**
 * Only the kept-alive feeds are re-created per path, so this view is reused
 * when one contract links to another and has to reload for the new id itself.
 */
describe('ContractDetailView — moving from one contract to another', () => {
  async function mountReused(first) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/contract/:noticeId', component: ContractDetailView },
        { path: '/spending', component: { template: '<div />' } },
        { path: '/company/:gmr_id', component: { template: '<div />' } },
        { path: '/authority/:authority_id', component: { template: '<div />' } },
      ],
    })
    await router.push(`/contract/${first}`)
    await router.isReady()
    const wrapper = mount(ContractDetailView, {
      global: { plugins: [makeTestI18n(), router], stubs: { ThemeToggle: true } },
    })
    await flushPromises()
    return { wrapper, router }
  }

  const answer = (title) => ({ ok: true, status: 200, json: async () => ({ title }) })

  it('loads the new contract when the id changes', async () => {
    mockFetch.mockImplementation(async (url) => answer(url.includes('n-2') ? 'Second contract' : 'First contract'))
    const { wrapper, router } = await mountReused('n-1')
    expect(wrapper.text()).toContain('First contract')

    await router.push('/contract/n-2')
    await flushPromises()

    expect(mockFetch).toHaveBeenLastCalledWith('/api/contracts/n-2')
    expect(wrapper.text()).toContain('Second contract')
    expect(wrapper.text()).not.toContain('First contract')
  })

  it('does not let a slow answer for the old contract overwrite the new one', async () => {
    let releaseFirst
    mockFetch.mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = () => resolve(answer('Stale contract')) }))
    const { wrapper, router } = await mountReused('n-1')

    mockFetch.mockImplementationOnce(async () => answer('Current contract'))
    await router.push('/contract/n-2')
    await flushPromises()
    releaseFirst()
    await flushPromises()

    expect(wrapper.text()).toContain('Current contract')
    expect(wrapper.text()).not.toContain('Stale contract')
  })
})

