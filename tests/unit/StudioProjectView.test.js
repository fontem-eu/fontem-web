import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
vi.mock('../../src/api/studio.js', async () => (await import('./helpers/studioApiMock.js')).makeStudioApiMock())
const push = vi.fn(); const replace = vi.fn()
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { projectId: 'p1' }, query: {} }), useRouter: () => ({ push, replace }) }))
import * as api from '../../src/api/studio.js'
import { useStudio } from '../../src/composables/useStudio.js'
import StudioProjectView from '../../src/views/StudioProjectView.vue'

const stubs = { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }
function seed(queries = [], plots = []) {
  api.__seed([{ id: 'p1', name: 'Corruption', created_by: 'u', queries, plots }])
}

describe('StudioProjectView (server-backed)', () => {
  beforeEach(() => { api.__reset(); useStudio().reset(); push.mockReset(); replace.mockReset() })

  it('lists queries + plots with badges', async () => {
    seed([{ id: 'q1', name: 'contracts', lang: 'cypher', query: 'MATCH (n) RETURN n' }],
         [{ id: 'pl1', name: 'Overview', spec: { chart: 'bar_h' } }])
    const w = mount(StudioProjectView, { global: { stubs } }); await flushPromises()
    expect(w.find('[data-testid="project-query"]').text()).toContain('contracts')
    expect(w.find('[data-testid="project-query"]').text()).toContain('Cypher')
    expect(w.find('[data-testid="project-plot"]').text()).toContain('Overview')
  })

  it('empty states with no queries/plots', async () => {
    seed([], [])
    const w = mount(StudioProjectView, { global: { stubs } }); await flushPromises()
    expect(w.text()).toContain('No queries yet')
    expect(w.text()).toContain('No plots yet')
  })

  it('new query creates via API and navigates to its editor', async () => {
    seed([], [])
    const w = mount(StudioProjectView, { global: { stubs } }); await flushPromises()
    await w.find('[data-testid="project-new-query"]').trigger('click'); await flushPromises()
    expect(api.createQuery).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/studio\/p\/p1\/q\//))
  })

  it('editing the name autosaves (debounced) via API', async () => {
    vi.useFakeTimers()
    seed([], [])
    const w = mount(StudioProjectView, { global: { stubs } }); await flushPromises()
    await w.find('[data-testid="project-name"]').setValue('Renamed project')
    vi.advanceTimersByTime(500); await flushPromises()
    expect(api.renameProject).toHaveBeenCalledWith('p1', 'Renamed project')
    vi.useRealTimers()
  })
})
