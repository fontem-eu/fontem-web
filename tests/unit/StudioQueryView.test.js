import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
vi.mock('../../src/api/studio.js', async () => (await import('./helpers/studioApiMock.js')).makeStudioApiMock())
const push = vi.fn(); const replace = vi.fn()
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { projectId: 'p1', queryId: 'q1' } }), useRouter: () => ({ push, replace }) }))
import * as api from '../../src/api/studio.js'
import { useStudio } from '../../src/composables/useStudio.js'
import { useAssistantContext } from '../../src/composables/useAssistantContext.js'
import { useStudioProposal } from '../../src/composables/useStudioProposal.js'
import StudioQueryView from '../../src/views/StudioQueryView.vue'

const QueryEditorStub = {
  props: ['modelValue', 'lang', 'placeholder', 'proposal'],
  emits: ['update:modelValue', 'run'],
  template: `<textarea data-testid="query-editor" :value="modelValue" :data-proposal="proposal != null ? '1' : null" @input="$emit('update:modelValue', $event.target.value)"></textarea>`,
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
  beforeEach(() => { api.__reset(); useStudio().reset(); useStudioProposal()._reset(); global.fetch = vi.fn(); push.mockReset(); replace.mockReset() })

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

// ── Assistant: conversation scope, proposals, entry points ──────────────
describe('StudioQueryView — assistant proposals', () => {
  const ctx = useAssistantContext()
  const proposals = useStudioProposal()
  const PROPOSED = 'MATCH (c:Company) RETURN count(c) AS companies'
  const proposeHere = () => proposals.propose({ projectId: 'p1', queryId: 'q1', query: PROPOSED, explanation: 'Counts companies instead of listing them.' })

  beforeEach(() => {
    // __reset() clears the fake db but not vi.fn call history — the PUT
    // counts below must not read a save made by an earlier test.
    vi.clearAllMocks()
    api.__reset(); useStudio().reset(); proposals._reset(); ctx.clearAssistRequest()
    global.fetch = vi.fn(); push.mockReset(); replace.mockReset()
  })

  it('registers the project conversation and a live snapshot of the open query', async () => {
    seedQuery()
    const w = mountView(); await flushPromises()
    expect(ctx.conversationKey.value).toBe('studio:p1')
    expect(ctx.studioTurnPayload()).toEqual(expect.objectContaining({
      project_id: 'p1', project_name: 'P',
      query: expect.objectContaining({ id: 'q1', name: 'Companies', lang: 'cypher', text: 'MATCH (c) RETURN c.name AS name', last_error: null }),
    }))
    // read at send time, not copied at registration: the assistant sees what the user is looking at
    await w.find('[data-testid="query-editor"]').setValue('MATCH (x) RETURN x')
    expect(ctx.studioTurnPayload().query.text).toBe('MATCH (x) RETURN x')
  })

  it('a viewer registers the project but no query (nothing to propose into)', async () => {
    api.__seed([{ id: 'p1', name: 'Shared', created_by: 'other',
      my_access: { level: 'viewer', can_edit: false, can_delete: false, can_share: false },
      plots: [], queries: [{ id: 'q1', name: 'q', lang: 'cypher', query: 'MATCH (n) RETURN n' }] }])
    mountView(); await flushPromises()
    expect(ctx.conversationKey.value).toBe('studio:p1')
    expect(ctx.studioTurnPayload().query).toBeNull()
  })

  it('a pending proposal for this query shows the bar, hands the editor the diff and holds Run + language', async () => {
    seedQuery()
    const w = mountView(); await flushPromises()
    proposeHere(); await flushPromises()
    const bar = w.find('[data-testid="query-proposal"]')
    expect(bar.exists()).toBe(true)
    expect(w.find('[data-testid="query-proposal-explanation"]').text()).toContain('Counts companies')
    expect(w.find('[data-testid="query-editor"]').attributes('data-proposal')).toBe('1')
    // the draft is untouched: the diff is drawn from the proposal, not written into the model
    expect(w.find('[data-testid="query-editor"]').element.value).toBe('MATCH (c) RETURN c.name AS name')
    expect(w.find('[data-testid="query-run"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="query-lang-sql"]').attributes('disabled')).toBeDefined()
    // the editor's Ctrl/Cmd+Enter shortcut goes the same way as the button
    w.findComponent(QueryEditorStub).vm.$emit('run'); await flushPromises()
    expect(global.fetch).not.toHaveBeenCalledWith('/api/query/cypher', expect.anything())
  })

  it('a pending proposal for another query shows nothing here', async () => {
    seedQuery()
    const w = mountView(); await flushPromises()
    proposals.propose({ projectId: 'p1', queryId: 'q-other', query: PROPOSED, explanation: 'x' }); await flushPromises()
    expect(w.find('[data-testid="query-proposal"]').exists()).toBe(false)
    expect(w.find('[data-testid="query-editor"]').attributes('data-proposal')).toBeUndefined()
    expect(w.find('[data-testid="query-run"]').attributes('disabled')).toBeUndefined()
  })

  it('accept puts the text in the draft, saves it exactly once and releases the lock', async () => {
    vi.useFakeTimers()
    seedQuery()
    const w = mountView(); await flushPromises()
    proposeHere(); await flushPromises()
    expect(api.updateQuery).not.toHaveBeenCalled()
    await w.find('[data-testid="query-proposal-accept"]').trigger('click'); await flushPromises()
    expect(w.find('[data-testid="query-editor"]').element.value).toBe(PROPOSED)
    expect(w.find('[data-testid="query-proposal"]').exists()).toBe(false)
    expect(w.find('[data-testid="query-editor"]').attributes('data-proposal')).toBeUndefined()
    expect(proposals.locked.value).toBe(false)
    // the debounced autosave must not follow up with a second PUT
    vi.advanceTimersByTime(600); await flushPromises()
    expect(api.updateQuery).toHaveBeenCalledTimes(1)
    expect(api.updateQuery).toHaveBeenCalledWith('p1', 'q1', expect.objectContaining({ query: PROPOSED }))
    vi.useRealTimers()
  })

  it('reject leaves the draft alone, writes nothing and releases the lock', async () => {
    vi.useFakeTimers()
    seedQuery()
    const w = mountView(); await flushPromises()
    proposeHere(); await flushPromises()
    await w.find('[data-testid="query-proposal-reject"]').trigger('click'); await flushPromises()
    expect(w.find('[data-testid="query-editor"]').element.value).toBe('MATCH (c) RETURN c.name AS name')
    expect(w.find('[data-testid="query-proposal"]').exists()).toBe(false)
    expect(proposals.locked.value).toBe(false)
    vi.advanceTimersByTime(600); await flushPromises()
    expect(api.updateQuery).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('a failed accept shows the error and keeps the proposal pending', async () => {
    seedQuery()
    api.updateQuery.mockRejectedValueOnce(new Error('HTTP 500'))
    const w = mountView(); await flushPromises()
    proposeHere(); await flushPromises()
    await w.find('[data-testid="query-proposal-accept"]').trigger('click'); await flushPromises()
    expect(w.find('[data-testid="query-proposal-error"]').text()).toContain('HTTP 500')
    expect(w.find('[data-testid="query-proposal"]').exists()).toBe(true)
    expect(proposals.locked.value).toBe(true)
  })

  it('offers the assistant with an empty editor, and the prompt leaves the store to the assistant', async () => {
    seedQuery('')
    const w = mountView(); await flushPromises()
    expect(w.find('[data-testid="query-assist-hint"]').exists()).toBe(true)
    await w.find('[data-testid="query-assist-ask"]').trigger('click')
    // Which store answers the question (graph, statistics, Virtuoso) is the
    // assistant's decision: the prompt must not pin a language.
    const prompt = ctx.assistRequest.value.prompt
    expect(prompt).toContain('Write a query that')
    for (const lang of ['Cypher', 'SQL', 'SPARQL']) expect(prompt).not.toContain(lang)
  })

  it('keeps offering the assistant once the query has text', async () => {
    seedQuery('MATCH (c) RETURN c.name AS name')
    const w = mountView(); await flushPromises()
    expect(w.find('[data-testid="query-assist-ask"]').exists()).toBe(true)
    await w.find('[data-testid="query-editor"]').setValue('MATCH (a:Authority) RETURN a')
    expect(w.find('[data-testid="query-assist-ask"]').exists()).toBe(true)
  })

  it('a failed run adds a fix next to the ask, and the fix prompt carries the error', async () => {
    seedQuery('CREATE (x)')
    global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: 'write not allowed' }) })
    const w = mountView(); await flushPromises()
    expect(w.find('[data-testid="query-assist-fix"]').exists()).toBe(false)
    await w.find('[data-testid="query-run"]').trigger('click'); await flushPromises()
    // Both doors at once: the ask stays, the fix joins it.
    expect(w.find('[data-testid="query-assist-ask"]').exists()).toBe(true)
    await w.find('[data-testid="query-assist-fix"]').trigger('click')
    expect(ctx.assistRequest.value.prompt).toContain('write not allowed')
  })

  it('viewers are offered neither door', async () => {
    api.__seed([{ id: 'p1', name: 'P', created_by: 'u', plots: [],
      my_access: { level: 'viewer', can_edit: false, can_delete: false, can_share: false },
      queries: [{ id: 'q1', name: 'Companies', lang: 'cypher', query: 'CREATE (x)' }] }])
    global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ detail: 'nope' }) })
    const w = mountView(); await flushPromises()
    expect(w.find('[data-testid="query-assist-ask"]').exists()).toBe(false)
    await w.find('[data-testid="query-run"]').trigger('click'); await flushPromises()
    expect(w.find('[data-testid="query-assist-fix"]').exists()).toBe(false)
  })

  it('a proposal that switches the store is shown in that language and saved with it', async () => {
    seedQuery()
    const w = mountView(); await flushPromises()
    const sparql = 'SELECT ?act WHERE { ?act a ?t } LIMIT 5'
    proposals.propose({ projectId: 'p1', queryId: 'q1', query: sparql, explanation: 'Legislation lives in Virtuoso.', lang: 'sparql' })
    await flushPromises()
    expect(w.find('[data-testid="query-proposal-lang"]').text()).toContain('Cypher → SPARQL')
    // Reviewed in the language it will be saved in.
    expect(w.findComponent(QueryEditorStub).props('lang')).toBe('sparql')
    await w.find('[data-testid="query-proposal-accept"]').trigger('click'); await flushPromises()
    expect(api.updateQuery).toHaveBeenCalledWith('p1', 'q1', expect.objectContaining({ query: sparql, lang: 'sparql' }))
    expect(w.find('[data-testid="query-lang-sparql"]').classes()).toContain('active')
  })

  it('a proposal in the same language says nothing about stores', async () => {
    seedQuery()
    const w = mountView(); await flushPromises()
    proposeHere(); await flushPromises()
    expect(w.find('[data-testid="query-proposal-lang"]').exists()).toBe(false)
    expect(w.findComponent(QueryEditorStub).props('lang')).toBe('cypher')
  })

  it('no hint while a proposal is pending', async () => {
    seedQuery('MATCH (c) RETURN c')
    const w = mountView(); await flushPromises()
    expect(w.find('[data-testid="query-assist-hint"]').exists()).toBe(true)
    proposeHere(); await flushPromises()
    expect(w.find('[data-testid="query-assist-hint"]').exists()).toBe(false)
  })
})
