import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'
import CohesionGrantsPanel from '../../src/components/CohesionGrantsPanel.vue'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
afterEach(() => { mockFetch.mockReset() })

function mountPanel() {
  return mount(CohesionGrantsPanel, {
    props: { gmrId: 'g1' },
    global: { plugins: [makeTestI18n()] },
  })
}

describe('CohesionGrantsPanel', () => {
  it('renders the grants a company attained with fund + amount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        gmr_id: 'g1', name: 'Acme', country: 'POL',
        grant_count: 2, total_eu_contribution: 153802.5,
        grants: [
          { title: 'Digitalisation', fund: 'ERDF',
            programme: 'Competitiveness PL', eu_contribution: 59877.7,
            start_date: '2024-03-01', year: 2024 },
          { title: 'Training', fund: 'ESF+', programme: 'HR PL',
            eu_contribution: 93924.8, start_date: '2023-01-01', year: 2023 },
        ],
      }),
    })
    const wrapper = mountPanel()
    await flushPromises()
    expect(wrapper.find('[data-testid="cohesion-grants-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cohesion-grants-summary"]').text()).toContain('2 grants')
    expect(wrapper.findAll('[data-testid^="cohesion-grant-"]').length).toBe(2)
    expect(wrapper.text()).toContain('ERDF')
  })

  it('renders nothing when the company has no cohesion grants', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ gmr_id: 'g1', grant_count: 0, grants: [] }),
    })
    const wrapper = mountPanel()
    await flushPromises()
    expect(wrapper.find('[data-testid="cohesion-grants-panel"]').exists()).toBe(false)
  })
})
