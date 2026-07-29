import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
vi.mock('../../src/api/studio.js', async () => (await import('./helpers/studioApiMock.js')).makeStudioApiMock())
const runTransform = vi.fn()
vi.mock('../../src/composables/useDuckDB.js', () => ({ useDuckDB: () => ({ runTransform, warmup: vi.fn() }) }))
let routeParams = { projectId: 'p1' }
const push = vi.fn(); const replace = vi.fn()
vi.mock('vue-router', () => ({ useRoute: () => ({ get params() { return routeParams } }), useRouter: () => ({ push, replace }) }))
import * as api from '../../src/api/studio.js'
import { useStudio } from '../../src/composables/useStudio.js'
import StudioPlotView from '../../src/views/StudioPlotView.vue'

const QueryEditorStub = {
  props: ['modelValue', 'lang', 'placeholder', 'schema'], emits: ['update:modelValue', 'run'],
  template: `<textarea data-testid="plot-transform-sql" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)"></textarea>`,
}
const stubs = {
  RouterLink: { props: ['to'], template: '<a><slot /></a>' },
  QueryEditor: QueryEditorStub,
  StudioMap: { props: ['rows', 'columns', 'geoCol', 'valueCol', 'level'], template: `<div data-testid="studio-map">map:{{geoCol}}/{{valueCol}}/L{{level}}</div>` },
  ChartSpec: { props: ['chart', 'chartProps'], template: '<div class="cs" :data-chart="chart">{{ (chartProps&&chartProps.data||[]).length }}</div>' },
}
function seedProject(plots = []) {
  api.__seed([{ id: 'p1', name: 'Corruption', created_by: 'u', plots,
    queries: [
      { id: 'q1', name: 'contracts', lang: 'cypher', query: 'MATCH (c) RETURN c.country AS country, c.v AS value' },
      { id: 'q2', name: 'migration', lang: 'sql', query: 'SELECT country, value FROM m' },
    ] }])
}

describe('StudioPlotView (server-backed, new + edit)', () => {
  beforeEach(() => { api.__reset(); useStudio().reset(); global.fetch = vi.fn(); runTransform.mockReset(); push.mockReset(); replace.mockReset(); routeParams = { projectId: 'p1' } })

  it('new: combines selected queries, charts, and SAVES the plot to the project', async () => {
    seedProject()
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['country', 'value'], rows: [['X', 1], ['Y', 2]] }) })
    runTransform.mockResolvedValue({ columns: ['country', 'total'], rows: [['X', 3], ['Y', 7]] })
    const w = mount(StudioPlotView, { global: { stubs } }); await flushPromises()
    const toggles = w.findAll('[data-testid="plot-query-toggle"] input')
    await toggles[0].setValue(true); await toggles[1].setValue(true)
    await w.find('[data-testid="plot-combine"]').trigger('click'); await flushPromises()
    // sources are fetched (columns on tick + the combine run); the combine gets both
    expect(global.fetch).toHaveBeenCalled()
    expect(runTransform.mock.calls[0][0].map((i) => i.name)).toEqual(['q1', 'q2'])
    expect(w.find('[data-testid="plot-result"] table').text()).toContain('total')
    expect(w.find('.cs').exists()).toBe(true)
    // save → createPlot with denormalized aliased sources
    await w.find('[data-testid="plot-save"]').trigger('click'); await flushPromises()
    expect(api.createPlot).toHaveBeenCalled()
    const spec = api.createPlot.mock.calls[0][1].spec
    expect(spec.sources[0].name).toBe('q1')
    expect(spec.sources[0].query).toContain('MATCH')
    expect(replace).toHaveBeenCalledWith(expect.stringMatching(/\/plot\//))
  })

  it('edit: loads a saved plot recipe, re-runs it, and updates on save', async () => {
    const spec = { sources: [{ name: 'q1', lang: 'cypher', query: 'MATCH (c) RETURN c.country AS country, c.v AS value' }],
      transform: 'SELECT country, value FROM q1', chart: 'bar_h', x: 'country', y: 'value' }
    seedProject([{ id: 'pl1', name: 'Overview', spec }])
    routeParams = { projectId: 'p1', plotId: 'pl1' }
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['country', 'value'], rows: [['X', 1]] }) })
    runTransform.mockResolvedValue({ columns: ['country', 'value'], rows: [['X', 1]] })
    const w = mount(StudioPlotView, { global: { stubs } }); await flushPromises()
    // stored source shown (edit mode), transform prefilled
    expect(w.find('[data-testid="plot-source"]').exists()).toBe(true)
    expect(w.find('[data-testid="plot-transform-sql"]').element.value).toContain('SELECT country')
    await w.find('[data-testid="plot-combine"]').trigger('click'); await flushPromises()
    await w.find('[data-testid="plot-save"]').trigger('click'); await flushPromises()
    expect(api.updatePlot).toHaveBeenCalledWith('p1', 'pl1', expect.objectContaining({ spec: expect.any(Object) }))
  })

  it('Map chart type auto-detects the NUTS column + level and renders the choropleth', async () => {
    seedProject()
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['country', 'value'], rows: [['X', 1]] }) })
    runTransform.mockResolvedValue({ columns: ['geo', 'offences'], rows: [['DE1', 10], ['DEA', 20], ['FRB', 5]] })
    const w = mount(StudioPlotView, { global: { stubs } }); await flushPromises()
    await w.findAll('[data-testid="plot-query-toggle"] input')[0].setValue(true)
    await w.find('[data-testid="plot-combine"]').trigger('click'); await flushPromises()
    await w.find('[data-testid="plot-chart"]').setValue('atlas_map'); await flushPromises()
    const map = w.find('[data-testid="studio-map"]')
    expect(map.exists()).toBe(true)
    // detected: geo=geo (all L1 codes -> level 1), value=offences
    expect(map.text()).toContain('geo/offences/L1')
    expect(w.find('[data-testid="plot-level"]').exists()).toBe(true)
  })

  it('renders a saved plot from the cached run on open (no re-click)', async () => {
    const spec = { sources: [{ name: 'q1', lang: 'cypher', query: 'MATCH (n) RETURN n' }], transform: 'SELECT * FROM q1', chart: 'bar_h', x: 'country', y: 'value' }
    seedProject([{ id: 'pl1', name: 'Saved', spec }])
    routeParams = { projectId: 'p1', plotId: 'pl1' }
    localStorage.setItem('fontem-studio-run:pl1', JSON.stringify({ columns: ['country', 'value'], rows: [['X', 3], ['Y', 7]] }))
    const w = mount(StudioPlotView, { global: { stubs } }); await flushPromises()
    // the chart + result render immediately, without clicking Run & combine
    expect(w.find('[data-testid="plot-result"] table').text()).toContain('country')
    expect(w.find('[data-testid="studio-plot"]').exists()).toBe(true)
  })

  it('pockets the combined plot as a live pipeline recipe', async () => {
    localStorage.clear()
    seedProject()
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['country', 'value'], rows: [['X', 1]] }) })
    runTransform.mockResolvedValue({ columns: ['country', 'total'], rows: [['X', 3]] })
    const w = mount(StudioPlotView, { global: { stubs } }); await flushPromises()
    await w.findAll('[data-testid="plot-query-toggle"] input')[0].setValue(true)
    await w.find('[data-testid="plot-combine"]').trigger('click'); await flushPromises()
    await w.find('[data-testid="plot-pocket"]').trigger('click'); await flushPromises()
    const pocket = JSON.parse(localStorage.getItem('gmr-pocket') || '[]')
    expect(pocket[0].widget_type).toBe('pipeline')
    expect(pocket[0].config.data_params.sources[0].name).toBe('q1')
    expect(pocket[0].config.props).toBeUndefined()
  })
})

describe('StudioPlotView — line-chart event annotations', () => {
  beforeEach(() => {
    // __reset() clears the fake db but not vi.fn call history — clear it so
    // assertions can't read a call made by an earlier describe block.
    vi.clearAllMocks()
    api.__reset(); useStudio().reset(); global.fetch = vi.fn()
    runTransform.mockReset(); push.mockReset(); replace.mockReset()
    routeParams = { projectId: 'p1' }
  })

  // Combine two sources, switch to a line chart, then point the event
  // markers at the SECOND (uncombined) source — a reform timeline.
  async function mountWithEvents() {
    seedProject()
    global.fetch.mockImplementation(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('cypher')
        ? { columns: ['year', 'rate'], rows: [[2015, 10], [2016, 20]] }
        : { columns: ['year', 'reform', 'note'], rows: [[2016, 'Consent law', 'Ja betyder ja']] }),
    }))
    runTransform.mockResolvedValue({ columns: ['year', 'rate'], rows: [[2015, 10], [2016, 20]] })
    const w = mount(StudioPlotView, { global: { stubs } }); await flushPromises()
    const toggles = w.findAll('[data-testid="plot-query-toggle"] input')
    await toggles[0].setValue(true); await toggles[1].setValue(true)
    await w.find('[data-testid="plot-combine"]').trigger('click'); await flushPromises()
    await w.find('[data-testid="plot-chart"]').setValue('line')
    return w
  }

  it('event controls appear only for line charts', async () => {
    const w = await mountWithEvents()
    expect(w.find('[data-testid="plot-events"]').exists()).toBe(true)
    await w.find('[data-testid="plot-chart"]').setValue('bar_h')
    expect(w.find('[data-testid="plot-events"]').exists()).toBe(false)
  })

  it('lists the raw (uncombined) sources as timeline options and their columns', async () => {
    const w = await mountWithEvents()
    const opts = w.find('[data-testid="plot-events-source"]').findAll('option').map((o) => o.text())
    expect(opts).toContain('q2')            // the timeline query is selectable
    // column pickers only appear once a source is chosen
    expect(w.find('[data-testid="plot-events-x"]').exists()).toBe(false)
    await w.find('[data-testid="plot-events-source"]').setValue('q2')
    const cols = w.find('[data-testid="plot-events-x"]').findAll('option').map((o) => o.text())
    expect(cols).toEqual(['year', 'reform', 'note'])   // columns of q2, not of the combine
  })

  it('persists a fully-configured events spec into the saved recipe', async () => {
    const w = await mountWithEvents()
    await w.find('[data-testid="plot-events-source"]').setValue('q2')
    await w.find('[data-testid="plot-events-x"]').setValue('year')
    await w.find('[data-testid="plot-events-label"]').setValue('reform')
    await w.find('[data-testid="plot-events-detail"]').setValue('note')
    await w.find('[data-testid="plot-save"]').trigger('click'); await flushPromises()
    const spec = api.createPlot.mock.calls.at(-1)[1].spec
    expect(spec.events).toEqual({ source: 'q2', x: 'year', label: 'reform', detail: 'note' })
  })

  it('omits events from the spec until source + x + label are all set', async () => {
    const w = await mountWithEvents()
    await w.find('[data-testid="plot-events-source"]').setValue('q2')
    await w.find('[data-testid="plot-events-x"]').setValue('year')
    // label still unset -> extractEvents could not resolve it, so don't persist
    await w.find('[data-testid="plot-save"]').trigger('click'); await flushPromises()
    expect(api.createPlot.mock.calls.at(-1)[1].spec.events).toBeUndefined()
  })

  it('restores a saved events config when reopening the plot', async () => {
    const spec = {
      sources: [{ name: 'q1', lang: 'cypher', query: 'MATCH (c) RETURN c.year AS year, c.v AS rate' }],
      transform: 'SELECT year, rate FROM q1', chart: 'line', x: 'year', series: ['rate'],
      events: { source: 'q2', x: 'year', label: 'reform' },
    }
    seedProject([{ id: 'pl1', name: 'Rape + reforms', spec }])
    routeParams = { projectId: 'p1', plotId: 'pl1' }
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ columns: ['year', 'rate'], rows: [[2015, 10]] }) })
    runTransform.mockResolvedValue({ columns: ['year', 'rate'], rows: [[2015, 10]] })
    const w = mount(StudioPlotView, { global: { stubs } }); await flushPromises()
    await w.find('[data-testid="plot-save"]').trigger('click'); await flushPromises()
    expect(api.updatePlot.mock.calls.at(-1)[2].spec.events).toEqual({ source: 'q2', x: 'year', label: 'reform' })
  })
})

