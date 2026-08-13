import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { makeTestI18n } from './helpers/i18n.js'

vi.mock('../../src/api/community.js', () => ({
  listNamedQueries: vi.fn(),
  getNamedQuery: vi.fn(),
  createNamedQuery: vi.fn(),
  updateNamedQuery: vi.fn(),
  deleteNamedQuery: vi.fn(),
  validateNamedQuery: vi.fn(),
  previewNamedQuery: vi.fn(),
}))
// CodeMirror needs a real DOM measurement pass; the editor itself is
// covered by its own tests, so stand in a plain textarea here.
vi.mock('../../src/components/QueryEditor.vue', () => ({
  default: {
    name: 'QueryEditor',
    props: ['modelValue', 'lang'],
    emits: ['update:modelValue'],
    template: '<textarea data-testid="query-body" :value="modelValue" '
      + '@input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}))

import FeedQueriesView from '../../src/views/FeedQueriesView.vue'
import {
  listNamedQueries, getNamedQuery, createNamedQuery, updateNamedQuery,
  deleteNamedQuery, validateNamedQuery, previewNamedQuery,
} from '../../src/api/community.js'

const SQL = 'SELECT 1 AS item_id'

function query(over = {}) {
  return {
    id: 'q1', slug: 'public-contracts', name: 'Public contracts', description: '',
    lang: 'sql', query: SQL, waivers: {}, status: 'draft', contract_ok: false,
    contract_report: null, validated_at: null, groups: [], ...over,
  }
}

function report(over = {}) {
  return {
    subscribable: true, duration_ms: 42, row_count: 3, columns: ['item_id'],
    checks: [{ id: 'binds_nuts', passed: true, reason: "binds 'nuts'", waived: false }],
    ...over,
  }
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/feed-queries', component: FeedQueriesView },
      { path: '/:rest(.*)', component: { template: '<div />' } },
    ],
  })
  await router.push('/admin/feed-queries')
  await router.isReady()
  const w = mount(FeedQueriesView, { global: { plugins: [router, makeTestI18n()] } })
  await flushPromises()
  return w
}

async function select(w) {
  await w.find('[data-testid="query-list"] button').trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  listNamedQueries.mockResolvedValue([query()])
  getNamedQuery.mockResolvedValue(query())
})

describe('FeedQueriesView', () => {
  it('lists the catalogue with status and contract state', async () => {
    listNamedQueries.mockResolvedValue([
      query({ id: 'a', name: 'Draft one', status: 'draft', contract_ok: false }),
      query({ id: 'b', name: 'Live one', status: 'published', contract_ok: true }),
    ])
    const w = await mountView()
    const text = w.find('[data-testid="query-list"]').text()
    expect(text).toContain('Draft one')
    expect(text).toContain('Live one')
    expect(text).toContain('published')
  })

  it('shows every contract check with its reason, passing or failing', async () => {
    getNamedQuery.mockResolvedValue(query({
      contract_report: report({
        subscribable: false,
        checks: [
          { id: 'columns', passed: true, reason: 'projects item_id, item_time', waived: false },
          { id: 'binds_since', passed: false, reason: 'no since bind — every run rescans', waived: false },
        ],
      }),
    }))
    const w = await mountView()
    await select(w)
    const panel = w.find('[data-testid="contract"]')
    expect(panel.text()).toContain('projects item_id, item_time')
    expect(panel.text()).toContain('no since bind — every run rescans')
    expect(panel.text()).toContain('Not subscribable')
  })

  it('reports the cost of the last validation', async () => {
    getNamedQuery.mockResolvedValue(query({
      contract_ok: true, validated_at: '2026-08-13T10:00:00Z',
      contract_report: report({ duration_ms: 1234, row_count: 87 }),
    }))
    const w = await mountView()
    await select(w)
    expect(w.find('[data-testid="cost"]').text()).toContain('1234 ms')
    expect(w.find('[data-testid="cost"]').text()).toContain('87 rows')
  })

  it('only offers a waiver box for the checks that may actually be waived', async () => {
    getNamedQuery.mockResolvedValue(query({
      contract_report: report({
        subscribable: false,
        checks: [
          { id: 'binds_nuts', passed: false, reason: 'no nuts bind', waived: false },
          { id: 'item_id_unique', passed: false, reason: 'duplicate item_ids', waived: false },
        ],
      }),
    }))
    const w = await mountView()
    await select(w)
    expect(w.find('[data-testid="waiver-binds_nuts"]').exists()).toBe(true)
    // A feed with no stable id is a re-notification bug; no explanation fixes it.
    expect(w.find('[data-testid="waiver-item_id_unique"]').exists()).toBe(false)
  })

  it('sends a typed waiver reason with the save', async () => {
    getNamedQuery.mockResolvedValue(query({
      contract_report: report({
        subscribable: false,
        checks: [{ id: 'binds_nuts', passed: false, reason: 'no nuts bind', waived: false }],
      }),
    }))
    updateNamedQuery.mockResolvedValue(query())
    const w = await mountView()
    await select(w)
    await w.find('[data-testid="waiver-binds_nuts"]').setValue('legal acts are EU-level')
    await w.find('[data-testid="save"]').trigger('click')
    await flushPromises()
    expect(updateNamedQuery.mock.calls.at(-1)[1].waivers)
      .toEqual({ binds_nuts: 'legal acts are EU-level' })
  })

  it('blocks validation while there are unsaved edits', async () => {
    const w = await mountView()
    await select(w)
    expect(w.find('[data-testid="validate"]').attributes('disabled')).toBeUndefined()

    await w.find('[data-testid="query-body"]').setValue(`${SQL} LIMIT 5`)
    await flushPromises()
    // Validating a saved query while the editor shows a different one would
    // record a verdict about something the admin cannot see.
    expect(w.find('[data-testid="validate"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="dirty-hint"]').exists()).toBe(true)
  })

  it('offers publish only once the contract has passed', async () => {
    const w = await mountView()
    await select(w)
    expect(w.find('[data-testid="publish"]').exists()).toBe(false)

    getNamedQuery.mockResolvedValue(query({ contract_ok: true, contract_report: report() }))
    validateNamedQuery.mockResolvedValue(query({ id: 'q1', contract_ok: true }))
    await w.find('[data-testid="validate"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="publish"]').exists()).toBe(true)
  })

  it('previews an unsaved draft without touching the catalogue', async () => {
    previewNamedQuery.mockResolvedValue({
      columns: ['item_id', 'title'], rows: [['c1', 'A contract']],
      row_count: 1, truncated: false, duration_ms: 20, error: null,
      contract: report(),
    })
    const w = await mountView()
    await select(w)
    await w.find('[data-testid="query-body"]').setValue('SELECT 2 AS item_id')
    await w.find('[data-testid="preview"]').trigger('click')
    await flushPromises()

    expect(previewNamedQuery.mock.calls.at(-1)[0].query).toBe('SELECT 2 AS item_id')
    expect(updateNamedQuery).not.toHaveBeenCalled()
    expect(w.find('[data-testid="preview-panel"]').text()).toContain('A contract')
  })

  it('surfaces the engine error from a failed preview', async () => {
    previewNamedQuery.mockResolvedValue({
      columns: [], rows: [], row_count: 0, truncated: false, duration_ms: 5,
      error: 'SQL error: relation "nope" does not exist', contract: report({ subscribable: false }),
    })
    const w = await mountView()
    await select(w)
    await w.find('[data-testid="preview"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="preview-panel"]').text()).toContain('relation "nope"')
  })

  it('creates a new query rather than patching the selected one', async () => {
    createNamedQuery.mockResolvedValue(query({ id: 'new' }))
    const w = await mountView()
    await select(w)
    await w.find('[data-testid="new-query"]').trigger('click')
    await w.find('[data-testid="field-slug"]').setValue('lobbying-energy')
    await w.find('[data-testid="save"]').trigger('click')
    await flushPromises()
    expect(createNamedQuery).toHaveBeenCalled()
    expect(updateNamedQuery).not.toHaveBeenCalled()
    expect(createNamedQuery.mock.calls.at(-1)[0].slug).toBe('lobbying-energy')
  })

  it('shows the server error instead of failing silently', async () => {
    updateNamedQuery.mockRejectedValue(new Error("HTTP 409: slug 'x' already exists"))
    const w = await mountView()
    await select(w)
    await w.find('[data-testid="save"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="error"]').text()).toContain('already exists')
  })

  it('asks before deleting', async () => {
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false)
    const w = await mountView()
    await select(w)
    await w.find('[data-testid="delete"]').trigger('click')
    await flushPromises()
    expect(confirmSpy).toHaveBeenCalled()
    expect(deleteNamedQuery).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })
})
