import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ConnectednessDQView from '../../src/views/dq/ConnectednessDQView.vue'

const FIXTURE = {
  stats: {
    total_nodes: 3958610,
    total_edges: 3510702,
    orphan_count: 1509728,
    mean_degree: 1.7737,
    median_degree: 1,
    max_degree: 247724,
  },
  distribution: [
    { bucket: 0, label: '0', nodes: 1509728 },
    { bucket: 1, label: '1', nodes: 1892379 },
    { bucket: 3, label: '2-3', nodes: 417895 },
    { bucket: 10, label: '4-10', nodes: 97534 },
    { bucket: 30, label: '11-30', nodes: 31647 },
    { bucket: 100, label: '31-100', nodes: 7443 },
    { bucket: 300, label: '101-300', nodes: 1593 },
    { bucket: 1000, label: '301-1000', nodes: 288 },
    { bucket: 10000, label: '1001-10000', nodes: 81 },
    { bucket: 999999, label: '10000+', nodes: 22 },
  ],
  hubs: [
    { labels: ['NUTSRegion'], id: 'Italia', degree: 247724 },
    { labels: ['NUTSRegion'], id: 'Deutschland', degree: 246079 },
  ],
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/admin/data-quality', component: { template: '<div />' } },
      { path: '/admin/data-quality/connectedness', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  await router.push('/admin/data-quality/connectedness')
  await router.isReady()
  const wrapper = mount(ConnectednessDQView, {
    global: {
      plugins: [router],
      stubs: {
        ThemeToggle: { template: '<div />' },
        HorizontalBarChart: {
          name: 'HorizontalBarChart',
          template: '<div data-testid="hbc" />',
          props: ['data', 'maxBars'],
        },
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('ConnectednessDQView', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => FIXTURE,
    }))
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders stat cards with formatted numbers + orphan %', async () => {
    const w = await mountView()
    const stats = w.find('[data-testid="dq-stats"]')
    expect(stats.exists()).toBe(true)
    const html = stats.html()
    expect(html).toContain('3,958,610')   // total nodes
    expect(html).toContain('3,510,702')   // total edges
    expect(html).toContain('1,509,728')   // orphan count
    expect(html).toContain('38.1%')       // 1509728 / 3958610
    expect(html).toContain('247,724')     // max degree
  })

  it('renders the hubs table with row per hub', async () => {
    const w = await mountView()
    const rows = w.findAll('[data-testid="hubs-table"] tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Italia')
    expect(rows[0].text()).toContain('247,724')
    expect(rows[1].text()).toContain('Deutschland')
  })

  it('renders the degree distribution chart stub with 10 buckets', async () => {
    const w = await mountView()
    const chart = w.findComponent({ name: 'HorizontalBarChart' })
    expect(chart.exists()).toBe(true)
    expect(chart.props('data')).toHaveLength(10)
    expect(chart.props('data')[0]).toEqual({ label: '0', value: 1509728 })
    expect(chart.props('data')[9]).toEqual({ label: '10000+', value: 22 })
  })

  it('shows error state when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const w = await mountView()
    expect(w.find('[data-testid="dq-error"]').exists()).toBe(true)
    expect(w.find('[data-testid="dq-stats"]').exists()).toBe(false)
  })
})
