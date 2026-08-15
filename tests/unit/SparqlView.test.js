import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

import SparqlView from '../../src/views/SparqlView.vue'

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status, statusText: `S${status}`,
    json: () => Promise.resolve(body),
  })
}

const SAMPLE_RESPONSE = {
  head: { vars: ['s', 'n'] },
  results: {
    bindings: [
      { s: { type: 'uri', value: 'http://example.com/x' },
        n: { type: 'literal', value: '42',
             datatype: 'http://www.w3.org/2001/XMLSchema#integer' } },
      { s: { type: 'uri', value: 'http://example.com/y' },
        n: { type: 'literal', value: '7',
             datatype: 'http://www.w3.org/2001/XMLSchema#integer' } },
    ],
  },
}

beforeEach(() => {
  global.fetch = vi.fn(() => jsonResponse(SAMPLE_RESPONSE))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SparqlView — editor + docs', () => {
  it('renders the documentation panel with the endpoint URL', () => {
    const wrapper = mount(SparqlView)
    expect(wrapper.find('[data-testid="sparql-meta"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sparql-endpoint-url"]').text())
      .toContain('/api/sparql')
  })

  it('seeds the textarea with an inventory query so Run works on landing', () => {
    const wrapper = mount(SparqlView)
    const editor = wrapper.find('[data-testid="sparql-editor"]')
    expect(editor.exists()).toBe(true)
    expect(editor.element.value).toContain('SELECT')
    expect(editor.element.value).toContain('GRAPH')
  })

  it('Run button POSTs the textarea content to /api/sparql', async () => {
    const wrapper = mount(SparqlView)
    await wrapper.find('[data-testid="sparql-run"]').trigger('click')
    await flushPromises()

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = global.fetch.mock.calls[0]
    expect(url).toBe('/api/sparql')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body).query).toContain('SELECT')
  })

  it('renders the results table with one row per binding', async () => {
    const wrapper = mount(SparqlView)
    await wrapper.find('[data-testid="sparql-run"]').trigger('click')
    await flushPromises()

    const table = wrapper.find('[data-testid="sparql-results"]')
    expect(table.exists()).toBe(true)
    const ths = table.findAll('thead th').map((t) => t.text())
    expect(ths).toEqual(['s', 'n'])
    expect(table.findAll('tbody tr').length).toBe(2)
    expect(table.text()).toContain('http://example.com/x')
    expect(table.text()).toContain('42')
  })

  it('IRI cells render as <a target="_blank">', async () => {
    const wrapper = mount(SparqlView)
    await wrapper.find('[data-testid="sparql-run"]').trigger('click')
    await flushPromises()

    const links = wrapper.find('[data-testid="sparql-results"]').findAll('a.sparql-iri')
    expect(links.length).toBeGreaterThanOrEqual(2)
    expect(links[0].attributes('href')).toBe('http://example.com/x')
    expect(links[0].attributes('target')).toBe('_blank')
  })

  it('shows the FastAPI `detail` error string when the backend 4xxs', async () => {
    global.fetch = vi.fn(() => jsonResponse(
      { detail: 'SPARQL UPDATE / INSERT / DELETE / ... not permitted' },
      400,
    ))
    const wrapper = mount(SparqlView)
    await wrapper.find('[data-testid="sparql-run"]').trigger('click')
    await flushPromises()

    const err = wrapper.find('[data-testid="sparql-error"]')
    expect(err.exists()).toBe(true)
    expect(err.text()).toContain('SPARQL UPDATE')
    expect(wrapper.find('[data-testid="sparql-results"]').exists()).toBe(false)
  })

  it('shows a clear error when Virtuoso is unconfigured (503)', async () => {
    global.fetch = vi.fn(() => jsonResponse(
      { detail: 'Virtuoso is not configured in this environment' },
      503,
    ))
    const wrapper = mount(SparqlView)
    await wrapper.find('[data-testid="sparql-run"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="sparql-error"]').text()).toContain('Virtuoso')
  })

  it('Run button is disabled while a request is in flight', async () => {
    let _resolve = null
    global.fetch = vi.fn(() => new Promise((r) => { _resolve = r }))
    const wrapper = mount(SparqlView)
    const btn = wrapper.find('[data-testid="sparql-run"]')

    await btn.trigger('click')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.text()).toBe('Running…')

    _resolve(jsonResponse(SAMPLE_RESPONSE))
    await flushPromises()
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.text()).toBe('Run query')
  })

  it('Run button is disabled when the editor is empty', async () => {
    const wrapper = mount(SparqlView)
    await wrapper.find('[data-testid="sparql-editor"]').setValue('   ')
    expect(wrapper.find('[data-testid="sparql-run"]').attributes('disabled')).toBeDefined()
  })

  it('clicking "Use this query" on an example loads it into the editor', async () => {
    // Order-independent on purpose: this used to click example 1 and expect
    // the sanctioned-entities sample, which broke the moment the examples
    // were reordered to put a cheap query first. What matters is that a
    // click loads THAT example, not which slot it sits in.
    const wrapper = mount(SparqlView)
    const loaders = wrapper.findAll('[data-testid^="sparql-example-load-"]')
    expect(loaders.length).toBeGreaterThan(1)
    const editor = () => wrapper.find('[data-testid="sparql-editor"]')
    const seen = new Set()
    for (const [i, loader] of loaders.entries()) {
      await loader.trigger('click')
      const loaded = editor().element.value
      expect(loaded.length, `example ${i} loaded nothing`).toBeGreaterThan(0)
      seen.add(loaded)
    }
    expect(seen.size, 'every example should load a distinct query')
      .toBe(loaders.length)
    // And the sanctioned-entities sample is still among them.
    expect([...seen].some((q) => q.includes('Organization') && q.includes('schema:name')))
      .toBe(true)
  })

  it('Cmd/Ctrl+Enter in the editor runs the query (keyboard shortcut)', async () => {
    const wrapper = mount(SparqlView)
    const editor = wrapper.find('[data-testid="sparql-editor"]')
    await editor.trigger('keydown', { key: 'Enter', ctrlKey: true })
    await flushPromises()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('shows row count + elapsed milliseconds after a successful run', async () => {
    const wrapper = mount(SparqlView)
    await wrapper.find('[data-testid="sparql-run"]').trigger('click')
    await flushPromises()
    const meta = wrapper.find('[data-testid="sparql-elapsed"]')
    expect(meta.exists()).toBe(true)
    expect(meta.text()).toMatch(/2 rows? in \d+ ms/)
  })

  it('Clear empties the textarea and the results table', async () => {
    const wrapper = mount(SparqlView)
    await wrapper.find('[data-testid="sparql-run"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="sparql-results"]').exists()).toBe(true)

    await wrapper.find('[data-testid="sparql-clear"]').trigger('click')
    expect(wrapper.find('[data-testid="sparql-editor"]').element.value).toBe('')
    expect(wrapper.find('[data-testid="sparql-results"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sparql-error"]').exists()).toBe(false)
  })
})
