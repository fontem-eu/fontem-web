import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
vi.mock('../../src/api/studio.js', async () => (await import('./helpers/studioApiMock.js')).makeStudioApiMock())
const push = vi.fn(); const replace = vi.fn()
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { projectId: 'p1', queryId: 'q1' } }), useRouter: () => ({ push, replace }) }))
import * as api from '../../src/api/studio.js'
import { useStudio } from '../../src/composables/useStudio.js'
import StudioQueryView from '../../src/views/StudioQueryView.vue'

const QueryEditorStub = {
  props: ['modelValue', 'lang', 'placeholder'],
  emits: ['update:modelValue', 'run'],
  template: `<textarea data-testid="query-editor" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)"></textarea>`,
}
const stubs = {
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  QueryEditor: QueryEditorStub,
  SchemaPanel: { props: ['lang'], template: `<div data-testid="schema-panel"/>` },
}
function seedQuery(q = 'MATCH (c) RETURN c.name AS name', lang = 'cypher') {
  api.__seed([{ id: 'p1', name: 'P', created_by: 'u', plots: [],
    queries: [{ id: 'q1', name: 'Companies', lang, query: q }] }])
}
const mountView = () => mount(StudioQueryView, { global: { stubs } })

describe('StudioQueryView (server-backed)', () => {
  beforeEach(() => { api.__reset(); useStudio().reset(); global.fetch = vi.fn(); push.mockReset(); replace.mockReset() })

  it('runs the query and shows a tabular result preview', async () => {
    seedQuery()
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['name'], rows: [['Acme'], ['Globex']] }) })
    const w = mountView(); await flushPromises()
    expect(w.find('[data-testid="studio-query-view"]').exists()).toBe(true)
    await w.find('[data-testid="query-run"]').trigger('click'); await flushPromises()
    expect(global.fetch).toHaveBeenCalledWith('/api/query/cypher', expect.objectContaining({ method: 'POST' }))
    const table = w.find('[data-testid="query-result"] table')
    expect(table.exists()).toBe(true)
    expect(table.text()).toContain('Acme')
    expect(w.find('[data-testid="query-meta"]').text()).toContain('2 rows')
  })

  it('shows an error and no table on a failed query', async () => {
    seedQuery('CREATE (x)')
    global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: 'write not allowed' }) })
    const w = mountView(); await flushPromises()
    await w.find('[data-testid="query-run"]').trigger('click'); await flushPromises()
    expect(w.find('[data-testid="query-error"]').text()).toContain('write not allowed')
    expect(w.find('[data-testid="query-result"]').exists()).toBe(false)
  })

  it('autosaves edits (debounced) via the API', async () => {
    vi.useFakeTimers()
    seedQuery()
    const w = mountView(); await flushPromises()
    await w.find('[data-testid="query-editor"]').setValue('MATCH (x) RETURN x')
    vi.advanceTimersByTime(500); await flushPromises()
    expect(api.updateQuery).toHaveBeenCalledWith('p1', 'q1', expect.objectContaining({ query: 'MATCH (x) RETURN x' }))
    vi.useRealTimers()
  })

  it('delete is a two-click inline confirm (no browser dialog)', async () => {
    seedQuery()
    const w = mountView(); await flushPromises()
    const btn = w.find('[data-testid="query-delete"]')
    await btn.trigger('click') // first click → confirm state, not deleted
    expect(api.deleteQuery).not.toHaveBeenCalled()
    expect(btn.text()).toContain('Confirm')
    await btn.trigger('click'); await flushPromises() // second click → deletes
    expect(api.deleteQuery).toHaveBeenCalledWith('p1', 'q1')
  })
})
