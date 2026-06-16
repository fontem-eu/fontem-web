/**
 * SourcePipelinePanel: the generic per-dashboard health panel. Fetches
 * /pipeline (filtered to its source) + the events timeline, renders the
 * health badge and a volume chart, and degrades gracefully.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

import SourcePipelinePanel from '../../src/components/SourcePipelinePanel.vue'

function mockFetch(pipeline, timeline, { pipelineOk = true, timelineOk = true } = {}) {
  global.fetch = vi.fn((url) => {
    if (url.includes('/timeline')) {
      return Promise.resolve({ ok: timelineOk, json: () => Promise.resolve(timeline) })
    }
    return Promise.resolve({ ok: pipelineOk, json: () => Promise.resolve(pipeline) })
  })
}

const stubs = { ZoomableBarChart: { props: ['data'], template: '<div class="chart-stub">{{ data.length }}</div>' } }

beforeEach(() => { vi.restoreAllMocks() })

describe('SourcePipelinePanel', () => {
  it('renders the health badge and maps the timeline into the chart', async () => {
    mockFetch(
      [{ id: 'gleif', stale: false, age_hours: 2, last_run_status: 'success',
         events_total: 100, events_30d: 50, deadletter: 0, deadletter_pct: 0 }],
      [{ day: '2026-06-01', events: 10 }, { day: '2026-06-02', events: 12 }],
    )
    const w = mount(SourcePipelinePanel, { props: { sourceId: 'gleif' }, global: { stubs } })
    await flushPromises()
    expect(w.find('[data-testid="source-health"]').exists()).toBe(true)
    expect(w.find('.chart-stub').text()).toBe('2')   // two days mapped
  })

  it('shows the empty state when the window has no events', async () => {
    mockFetch([{ id: 'nuts' }], [])
    const w = mount(SourcePipelinePanel, { props: { sourceId: 'nuts' }, global: { stubs } })
    await flushPromises()
    expect(w.find('.chart-stub').exists()).toBe(false)
    expect(w.text()).toContain('No events recorded')
  })

  it('reports unavailable when both fetches fail', async () => {
    mockFetch([], [], { pipelineOk: false, timelineOk: false })
    const w = mount(SourcePipelinePanel, { props: { sourceId: 'gleif' }, global: { stubs } })
    await flushPromises()
    expect(w.text()).toContain('unavailable')
  })
})
