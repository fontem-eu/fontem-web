/**
 * Source-freshness panel on the Data Quality hub view.
 *
 * The panel renders one row per :DataSource marker fed back by the
 * /api/data-quality/source-freshness endpoint. Stale sources get
 * a STALE pill so an operator scanning the dashboard spots a
 * missed cron run without having to read each row.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

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
    global: { plugins: [router] },
  })
  await flushPromises()
  await flushPromises()  // one for /data-quality, one for /source-freshness
  return wrapper
}

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('DataQualityHubView source-freshness panel', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url) => {
      if (url.endsWith('/api/data-quality')) {
        return jsonResponse({ graph: { nodes: { Company: 100 }, relationships: 0 } })
      }
      if (url.endsWith('/api/data-quality/source-freshness')) {
        return jsonResponse({
          sources: [
            {
              id: 'sanctions',
              label: 'EU consolidated sanctions',
              coverage_start: '2026-01-01',
              coverage_end: '2026-04-29',
              record_count: 3015,
              expected_cadence_hours: 25,
              last_loaded: '2026-04-29T07:00:00+00:00',
              age_hours: 2.0,
              stale: false,
            },
            {
              id: 'openfigi',
              label: 'OpenFIGI tickers',
              coverage_start: null,
              coverage_end: null,
              record_count: 12345,
              expected_cadence_hours: 200,
              last_loaded: '2026-03-01T08:00:00+00:00',
              age_hours: 600.0,
              stale: true,
            },
          ],
          generated_at: '2026-04-29T09:30:00+00:00',
        })
      }
      return jsonResponse({}, 404)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders one row per source with coverage range and rows count', async () => {
    const wrapper = await mountView()
    const panel = wrapper.find('[data-test="source-freshness"]')
    expect(panel.exists()).toBe(true)
    const rows = panel.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(panel.text()).toContain('EU consolidated sanctions')
    expect(panel.text()).toContain('2026-01-01 → 2026-04-29')
    expect(panel.text()).toContain('3,015')
  })

  it('flags stale sources with a STALE pill so they are visible at a glance', async () => {
    const wrapper = await mountView()
    const stale = wrapper.find('[data-source-id="openfigi"]')
    expect(stale.classes()).toContain('dqh-row-stale')
    expect(stale.find('.dqh-pill-stale').exists()).toBe(true)
    expect(stale.text()).toContain('STALE')
  })

  it('does not render the panel when the endpoint fails', async () => {
    global.fetch = vi.fn((url) => {
      if (url.endsWith('/api/data-quality')) {
        return jsonResponse({ graph: { nodes: { Company: 1 }, relationships: 0 } })
      }
      return jsonResponse({}, 500)
    })
    const wrapper = await mountView()
    expect(wrapper.find('[data-test="source-freshness"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Source freshness unavailable')
  })
})
