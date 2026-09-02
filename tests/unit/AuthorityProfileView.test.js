/**
 * The authority page.
 *
 * It exists so the authority sitemap shards can be advertised at all:
 * fontem-api has had them ready, held out of the index because the SPA
 * catch-all answered 200 with a not-found view for /authority/<id>, and
 * ~16,000 sitemap entries pointing at that is ~16,000 soft-404s.
 *
 * So the case that matters most here is the unhappy one — an id that is
 * not in the graph must read as absent, not as an authority with no
 * contracts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AuthorityProfileView from '../../src/views/AuthorityProfileView.vue'
import { makeTestI18n } from './helpers/i18n.js'

const AUTHORITY = {
  authority_id: 'a-1',
  authority_name: 'Museus e Monumentos de Portugal, EPE',
  country: 'PRT',
  contract_count: 3,
  total_spend_eur: 1441557.34,
  recent_contracts: [
    { ted_notice_id: 'n-1', title: 'Digital projection equipment', value_eur: 900000, publication_date: '2026-03-01' },
    { ted_notice_id: 'n-2', title: 'Museum lighting', value_eur: 541557.34, publication_date: '2026-04-02' },
  ],
}

async function mountView(fetchImpl) {
  vi.stubGlobal('fetch', fetchImpl)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/authority/:authority_id', component: AuthorityProfileView },
      { path: '/contract/:noticeId', component: { template: '<div/>' } },
      { path: '/', component: { template: '<div/>' } },
    ],
  })
  await router.push('/authority/a-1')
  await router.isReady()
  const wrapper = mount(AuthorityProfileView, {
    global: { plugins: [router, makeTestI18n()] },
  })
  await flushPromises()
  return wrapper
}

const ok = (body) => vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body })

beforeEach(() => { document.title = '' })
afterEach(() => { vi.restoreAllMocks() })

describe('AuthorityProfileView', () => {
  it('names the authority and its country', async () => {
    const wrapper = await mountView(ok(AUTHORITY))
    expect(wrapper.text()).toContain('Museus e Monumentos de Portugal')
    expect(wrapper.text()).toContain('PRT')
  })

  it('lists the contracts, each linking to the contract page', async () => {
    const wrapper = await mountView(ok(AUTHORITY))
    const links = wrapper.findAll('[data-testid="authority-contracts"] a')
    expect(links).toHaveLength(2)
    expect(links[0].attributes('href')).toBe('/contract/n-1')
    expect(links[0].text()).toContain('Digital projection equipment')
  })

  it('a 404 reads as absent, not as an authority with nothing in it', async () => {
    // The whole reason this page exists. A blank-but-present page on a
    // sitemap URL is a soft-404, which is worse than a real one.
    const wrapper = await mountView(
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }))
    expect(wrapper.text()).toMatch(/not found/i)
    expect(wrapper.find('[data-testid="authority-contracts"]').exists()).toBe(false)
  })

  it('a transport failure also reads as absent rather than throwing', async () => {
    const wrapper = await mountView(vi.fn().mockRejectedValue(new Error('offline')))
    expect(wrapper.text()).toMatch(/not found/i)
  })

  it('an authority with no contracts says so instead of showing an empty list', async () => {
    const wrapper = await mountView(ok({ ...AUTHORITY, recent_contracts: [] }))
    expect(wrapper.find('[data-testid="authority-contracts"]').exists()).toBe(false)
    expect(wrapper.text()).toMatch(/no contracts/i)
  })

  it('titles the document after the authority', async () => {
    await mountView(ok(AUTHORITY))
    expect(document.title).toContain('Museus e Monumentos de Portugal')
  })

  it('requests the authority by the id in the route', async () => {
    const spy = ok(AUTHORITY)
    await mountView(spy)
    expect(spy.mock.calls[0][0]).toContain('/api/authorities/a-1')
  })
})
