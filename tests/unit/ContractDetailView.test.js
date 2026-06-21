import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
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
