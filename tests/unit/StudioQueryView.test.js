import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const push = vi.fn(); const replace = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { projectId: 'P1', queryId: 'Q1' } }),
  useRouter: () => ({ push, replace }),
}))

import { useStudio } from '../../src/composables/useStudio.js'
import StudioQueryView from '../../src/views/StudioQueryView.vue'

const stubs = { RouterLink: { props: ['to'], template: '<a><slot /></a>' } }

describe('StudioQueryView (single-query editor + preview)', () => {
  beforeEach(() => { global.fetch = vi.fn(); push.mockReset(); replace.mockReset() })

  it('runs the query and shows a tabular result preview', async () => {
    // Build store state with deterministic ids matching the mocked route.
    localStorage.setItem('fontem-studio', JSON.stringify({ projects: [
      { id: 'P1', name: 'P', createdAt: 't', plots: [], queries: [{ id: 'Q1', name: 'Companies', lang: 'cypher', query: 'MATCH (c) RETURN c.name AS name', updatedAt: 't' }] },
    ] }))
    useStudio().refresh()
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['name'], rows: [['Acme'], ['Globex']] }) })
    const w = mount(StudioQueryView, { global: { stubs } })
    expect(w.find('[data-testid="studio-query-view"]').exists()).toBe(true)
    await w.find('[data-testid="query-run"]').trigger('click'); await flushPromises()
    expect(global.fetch).toHaveBeenCalledWith('/api/query/cypher', expect.objectContaining({ method: 'POST' }))
    const table = w.find('[data-testid="query-result"] table')
    expect(table.exists()).toBe(true)
    expect(table.text()).toContain('Acme')
    expect(w.find('[data-testid="query-meta"]').text()).toContain('2 rows')
  })

  it('shows an error and no table on a failed query', async () => {
    localStorage.setItem('fontem-studio', JSON.stringify({ projects: [
      { id: 'P1', name: 'P', createdAt: 't', plots: [], queries: [{ id: 'Q1', name: 'C', lang: 'cypher', query: 'CREATE (x)', updatedAt: 't' }] },
    ] }))
    useStudio().refresh()
    global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: 'write not allowed' }) })
    const w = mount(StudioQueryView, { global: { stubs } })
    await w.find('[data-testid="query-run"]').trigger('click'); await flushPromises()
    expect(w.find('[data-testid="query-error"]').text()).toContain('write not allowed')
    expect(w.find('[data-testid="query-result"]').exists()).toBe(false)
  })

  it('empty result set shows a friendly message, not an empty table', async () => {
    localStorage.setItem('fontem-studio', JSON.stringify({ projects: [
      { id: 'P1', name: 'P', createdAt: 't', plots: [], queries: [{ id: 'Q1', name: 'C', lang: 'cypher', query: 'MATCH (n) RETURN n LIMIT 0', updatedAt: 't' }] },
    ] }))
    useStudio().refresh()
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['n'], rows: [] }) })
    const w = mount(StudioQueryView, { global: { stubs } })
    await w.find('[data-testid="query-run"]').trigger('click'); await flushPromises()
    expect(w.find('[data-testid="query-result"]').text()).toContain('no rows')
  })
})
