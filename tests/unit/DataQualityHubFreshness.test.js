/**
 * Data-freshness panel on the Data Quality hub view.
 *
 * The original `/api/data-quality/source-freshness` URL was a 404 — no
 * such endpoint ever existed; the view greeted every operator with a
 * permanent "Source freshness unavailable: HTTP 404" banner. Repointed
 * at the real `/api/data-quality/freshness` endpoint, the panel now
 * surfaces the latest contract-load timestamp, the publication date
 * range, and per-system filing counts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

import DataQualityHubView from '../../src/views/DataQualityHubView.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/data-quality', component: DataQualityHubView },
      { path: '/data-quality/:slug', component: { template: '<div />' } },
      { path: '/admin', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  await router.push('/data-quality')
  await router.isReady()
  const wrapper = mount(DataQualityHubView, {
    global: { plugins: [router, makeTestI18n()] },
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('DataQualityHubView freshness panel', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url) => {
      if (url.endsWith('/api/data-quality')) {
        return jsonResponse({ graph: { nodes: { Company: 100 }, relationships: 0 } })
      }
      // Production-shaped response from the LIVE backend endpoint:
      // `latest_contract_load`, `contract_date_range`, `financial_sources`.
      if (url.endsWith('/api/data-quality/freshness')) {
        return jsonResponse({
          latest_contract_load: '2026-05-29T07:00:00+00:00',
          contract_date_range: { earliest: '2024-03-13', latest: '2026-04-29' },
          financial_sources: [
            { source: 'edgar', n: 44392 },
            { source: 'esef', n: 11167 },
          ],
        })
      }
      return jsonResponse({}, 404)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the LIVE `/api/data-quality/freshness` endpoint (not the legacy `/source-freshness` 404)', async () => {
    await mountView()
    const calls = global.fetch.mock.calls.map(([url]) => url)
    expect(calls).toContain('/api/data-quality/freshness')
    expect(calls).not.toContain('/api/data-quality/source-freshness')
  })

  it('renders the freshness section with the live shape', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('[data-testid="source-freshness"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Data freshness')
  })

  it('shows the latest contract-load timestamp', async () => {
    const wrapper = await mountView()
    const cell = wrapper.find('[data-testid="freshness-latest-contract-load"]')
    expect(cell.exists()).toBe(true)
    // jsdom uses an en-US locale by default → matches the Intl output.
    expect(cell.text()).toMatch(/2026/)
    expect(cell.text()).not.toBe('—')
  })

  it('shows the contract publication range', async () => {
    const wrapper = await mountView()
    const cell = wrapper.find('[data-testid="freshness-contract-range"]')
    expect(cell.exists()).toBe(true)
    expect(cell.text()).toContain('2024-03-13')
    expect(cell.text()).toContain('2026-04-29')
    expect(cell.text()).toContain('→')
  })

  it('renders one chip per financial source with its row count', async () => {
    const wrapper = await mountView()
    const sources = wrapper.find('[data-testid="freshness-financial-sources"]')
    expect(sources.exists()).toBe(true)
    expect(sources.text()).toContain('edgar')
    expect(sources.text()).toContain('44,392')
    expect(sources.text()).toContain('esef')
    expect(sources.text()).toContain('11,167')
  })

  it('shows the error banner (not the panel) when the endpoint 500s', async () => {
    global.fetch = vi.fn((url) => {
      if (url.endsWith('/api/data-quality')) {
        return jsonResponse({ graph: { nodes: { Company: 1 }, relationships: 0 } })
      }
      return jsonResponse({}, 500)
    })
    const wrapper = await mountView()
    expect(wrapper.find('[data-testid="source-freshness"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dqh-freshness-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Data freshness unavailable')
  })

  it('hides the panel entirely when every freshness field is missing (no zero-content section)', async () => {
    global.fetch = vi.fn((url) => {
      if (url.endsWith('/api/data-quality')) {
        return jsonResponse({ graph: { nodes: { Company: 1 }, relationships: 0 } })
      }
      if (url.endsWith('/api/data-quality/freshness')) {
        return jsonResponse({
          latest_contract_load: null,
          contract_date_range: null,
          financial_sources: [],
        })
      }
      return jsonResponse({}, 404)
    })
    const wrapper = await mountView()
    expect(wrapper.find('[data-testid="source-freshness"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dqh-freshness-error"]').exists()).toBe(false)
  })
})
