import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { makeTestI18n } from './helpers/i18n.js'
import DataStudioView from '../../src/views/DataStudioView.vue'

const mountView = () => mount(DataStudioView, { global: { plugins: [makeTestI18n()] } })

describe('DataStudioView', () => {
  beforeEach(() => { global.fetch = vi.fn() })

  it('shows a toolbar + empty state until New query', async () => {
    const w = mountView()
    expect(w.find('[data-testid="studio-toolbar"]').exists()).toBe(true)
    expect(w.find('[data-testid="studio-empty"]').exists()).toBe(true)
    expect(w.find('[data-testid="studio-panel"]').exists()).toBe(false)
  })

  it('New query opens the panel with a Cypher sample; switching language swaps the sample', async () => {
    const w = mountView()
    await w.find('[data-testid="studio-new-query"]').trigger('click')
    expect(w.find('[data-testid="studio-panel"]').exists()).toBe(true)
    expect(w.find('[data-testid="studio-editor"]').element.value).toContain('MATCH')
    await w.find('[data-testid="studio-lang-sparql"]').trigger('click')
    expect(w.find('[data-testid="studio-editor"]').element.value).toContain('SELECT ?s')
  })

  it('runs a Cypher query and renders the results table', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['company', 'contracts'], rows: [['Acme', 5], ['Beta', 3]], truncated: false }) })
    const w = mountView()
    await w.find('[data-testid="studio-new-query"]').trigger('click')
    await w.find('[data-testid="studio-run"]').trigger('click'); await flushPromises()
    expect(global.fetch).toHaveBeenCalledWith('/api/query/cypher', expect.objectContaining({ method: 'POST' }))
    const table = w.find('[data-testid="studio-results"] table')
    expect(table.exists()).toBe(true)
    expect(table.text()).toContain('company'); expect(table.text()).toContain('Acme')
  })

  it('normalizes a SPARQL bindings response into columns/rows', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ head: { vars: ['s', 'o'] }, results: { bindings: [{ s: { value: 'x' }, o: { value: '1' } }] } }) })
    const w = mountView()
    await w.find('[data-testid="studio-new-query"]').trigger('click')
    await w.find('[data-testid="studio-lang-sparql"]').trigger('click')
    await w.find('[data-testid="studio-run"]').trigger('click'); await flushPromises()
    expect(global.fetch).toHaveBeenCalledWith('/api/sparql', expect.anything())
    expect(w.find('[data-testid="studio-results"] table').text()).toContain('x')
  })

  it('surfaces a server error (e.g. forbidden write) without a table', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: 'Cypher: write/DDL keyword not allowed' }) })
    const w = mountView()
    await w.find('[data-testid="studio-new-query"]').trigger('click')
    await w.find('[data-testid="studio-run"]').trigger('click'); await flushPromises()
    expect(w.find('[data-testid="studio-error"]').text()).toContain('write/DDL')
    expect(w.find('[data-testid="studio-results"]').exists()).toBe(false)
  })
})
