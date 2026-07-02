import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
vi.mock('../../src/api/studio.js', async () => (await import('./helpers/studioApiMock.js')).makeStudioApiMock())
const push = vi.fn()
let routeParams = {}
vi.mock('vue-router', () => ({ useRoute: () => ({ get params() { return routeParams } }), useRouter: () => ({ push }) }))
import * as api from '../../src/api/studio.js'
import { useStudio } from '../../src/composables/useStudio.js'
import StudioNav from '../../src/components/StudioNav.vue'

function seed() {
  api.__seed([{ id: 'p1', name: 'Corruption', created_by: 'u',
    queries: [{ id: 'q1', name: 'contracts', lang: 'cypher', query: 'MATCH (n) RETURN n' }],
    plots: [{ id: 'pl1', name: 'Overview', spec: { chart: 'bar_h' } }] }])
}

describe('StudioNav (server-backed drawer tree)', () => {
  beforeEach(() => { api.__reset(); useStudio().reset(); push.mockReset(); routeParams = {} })

  it('renders projects; expanding reveals queries + plots + add actions', async () => {
    seed()
    const w = mount(StudioNav); await flushPromises()
    expect(w.find('[data-testid="studio-nav-project"]').text()).toContain('Corruption')
    expect(w.find('[data-testid="studio-nav-query"]').exists()).toBe(false)
    await w.find('[data-testid="nav-project-toggle-p1"]').trigger('click')
    expect(w.find('[data-testid="studio-nav-query"]').text()).toContain('contracts')
    expect(w.find('[data-testid="studio-nav-plot"]').text()).toContain('Overview')
    expect(w.find('[data-testid="nav-new-query"]').exists()).toBe(true)
    expect(w.find('[data-testid="nav-new-plot"]').exists()).toBe(true)
  })

  it('auto-expands the project in the current route', async () => {
    seed(); routeParams = { projectId: 'p1' }
    const w = mount(StudioNav); await flushPromises()
    expect(w.find('[data-testid="studio-nav-query"]').exists()).toBe(true)
  })

  it('new project creates via API and navigates (no prompt)', async () => {
    const w = mount(StudioNav); await flushPromises()
    await w.find('[data-testid="nav-new-project"]').trigger('click'); await flushPromises()
    expect(api.createProject).toHaveBeenCalledWith('Untitled project')
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/studio\/p\//))
  })

  it('inline-renames a query (no prompt)', async () => {
    seed(); routeParams = { projectId: 'p1' }
    const w = mount(StudioNav); await flushPromises()
    await w.find('[data-testid="nav-query-menu"]').trigger('click')
    await w.find('[data-testid="nav-menu"] [data-testid="menu-rename"]').trigger('click')
    const input = w.find('[data-testid="nav-rename"]')
    expect(input.exists()).toBe(true)
    await input.setValue('awards')
    await input.trigger('keyup.enter'); await flushPromises()
    expect(api.updateQuery).toHaveBeenCalledWith('p1', 'q1', { name: 'awards' })
  })

  it('deletes a project via two-click confirm (no confirm dialog)', async () => {
    seed()
    const w = mount(StudioNav); await flushPromises()
    await w.find('[data-testid="nav-project-menu"]').trigger('click')
    await w.find('[data-testid="menu-delete"]').trigger('click') // arm
    expect(api.deleteProject).not.toHaveBeenCalled()
    await w.find('[data-testid="menu-delete-confirm"]').trigger('click'); await flushPromises()
    expect(api.deleteProject).toHaveBeenCalledWith('p1')
  })

  it('navigates to a plot editor from the tree', async () => {
    seed(); routeParams = { projectId: 'p1' }
    const w = mount(StudioNav); await flushPromises()
    await w.find('[data-testid="studio-nav-plot"] .srow-label').trigger('click')
    expect(push).toHaveBeenCalledWith('/studio/p/p1/plot/pl1')
  })

  it('add buttons create a query and a plot and navigate', async () => {
    seed(); routeParams = { projectId: 'p1' }
    const w = mount(StudioNav); await flushPromises()
    await w.find('[data-testid="nav-new-query"]').trigger('click'); await flushPromises()
    expect(api.createQuery).toHaveBeenCalledWith('p1', {})
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/\/studio\/p\/p1\/q\//))
    await w.find('[data-testid="nav-new-plot"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/studio/p/p1/plot')
  })

  it('duplicates a query from its menu and navigates to the copy', async () => {
    seed(); routeParams = { projectId: 'p1' }
    const w = mount(StudioNav); await flushPromises()
    await w.find('[data-testid="nav-query-menu"]').trigger('click')
    await w.find('[data-testid="nav-menu"] [data-testid="menu-duplicate"]').trigger('click'); await flushPromises()
    expect(api.duplicateQuery).toHaveBeenCalledWith('p1', 'q1')
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/\/studio\/p\/p1\/q\//))
  })

  it('inline-renames a project and a plot; esc cancels without saving', async () => {
    seed(); routeParams = { projectId: 'p1' }
    const w = mount(StudioNav); await flushPromises()
    // project rename
    await w.find('[data-testid="nav-project-menu"]').trigger('click')
    await w.find('[data-testid="nav-menu"] [data-testid="menu-rename"]').trigger('click')
    let input = w.find('[data-testid="nav-rename"]')
    await input.setValue('Renamed')
    await input.trigger('keyup.enter'); await flushPromises()
    expect(api.renameProject).toHaveBeenCalledWith('p1', 'Renamed')
    // plot rename, then cancel via esc → no update
    await w.find('[data-testid="nav-plot-menu"]').trigger('click')
    await w.find('[data-testid="nav-menu"] [data-testid="menu-rename"]').trigger('click')
    input = w.find('[data-testid="nav-rename"]')
    await input.setValue('nope')
    await input.trigger('keyup.esc'); await flushPromises()
    expect(api.updatePlot).not.toHaveBeenCalled()
  })

  it('deletes a query and a plot via two-click confirm', async () => {
    seed(); routeParams = { projectId: 'p1' }
    const w = mount(StudioNav); await flushPromises()
    // query delete
    await w.find('[data-testid="nav-query-menu"]').trigger('click')
    await w.find('[data-testid="menu-delete"]').trigger('click')
    await w.find('[data-testid="menu-delete-confirm"]').trigger('click'); await flushPromises()
    expect(api.deleteQuery).toHaveBeenCalledWith('p1', 'q1')
    // plot delete
    await w.find('[data-testid="nav-plot-menu"]').trigger('click')
    await w.find('[data-testid="menu-delete"]').trigger('click')
    await w.find('[data-testid="menu-delete-confirm"]').trigger('click'); await flushPromises()
    expect(api.deletePlot).toHaveBeenCalledWith('p1', 'pl1')
  })
})
