import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const push = vi.fn()
let routeParams = {}
vi.mock('vue-router', () => ({
  useRoute: () => ({ get params() { return routeParams } }),
  useRouter: () => ({ push }),
}))
import { useStudio } from '../../src/composables/useStudio.js'
import StudioNav from '../../src/components/StudioNav.vue'

function seed() {
  localStorage.setItem('fontem-studio', JSON.stringify({ projects: [
    { id: 'P1', name: 'Corruption', createdAt: 't', plots: [], queries: [
      { id: 'Q1', name: 'contracts', lang: 'cypher', query: 'MATCH (n) RETURN n', updatedAt: 't' },
    ] },
  ] }))
  useStudio().refresh()
}

describe('StudioNav (drawer projects → queries tree)', () => {
  beforeEach(() => { localStorage.clear(); push.mockReset(); routeParams = {} })
  afterEach(() => { vi.unstubAllGlobals() })

  it('renders projects; expanding reveals queries and a New query action', async () => {
    seed()
    const w = mount(StudioNav)
    expect(w.find('[data-testid="studio-nav-project"]').text()).toContain('Corruption')
    // not expanded yet -> no query rows
    expect(w.find('[data-testid="studio-nav-query"]').exists()).toBe(false)
    await w.find('[data-testid="nav-project-toggle-P1"]').trigger('click')
    expect(w.find('[data-testid="studio-nav-query"]').text()).toContain('contracts')
    expect(w.find('[data-testid="nav-new-query"]').exists()).toBe(true)
  })

  it('auto-expands the project in the current route', () => {
    seed(); routeParams = { projectId: 'P1' }
    const w = mount(StudioNav)
    expect(w.find('[data-testid="studio-nav-query"]').exists()).toBe(true)
  })

  it('new project prompts for a name, creates it, and navigates', async () => {
    localStorage.clear(); useStudio().refresh()
    vi.stubGlobal('prompt', () => 'Lobby money')
    const w = mount(StudioNav)
    await w.find('[data-testid="nav-new-project"]').trigger('click'); await flushPromises()
    expect(useStudio().projects.value[0].name).toBe('Lobby money')
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/studio\/p\//))
  })

  it('query context menu can rename via prompt', async () => {
    seed(); routeParams = { projectId: 'P1' }
    vi.stubGlobal('prompt', () => 'awards')
    const w = mount(StudioNav)
    await w.find('[data-testid="nav-query-menu"]').trigger('click')
    await w.find('[data-testid="nav-menu"] [data-testid="menu-rename"]').trigger('click')
    expect(useStudio().getQuery('P1', 'Q1').name).toBe('awards')
  })

  it('project context menu deletes via confirm', async () => {
    seed()
    vi.stubGlobal('confirm', () => true)
    const w = mount(StudioNav)
    await w.find('[data-testid="nav-project-menu"]').trigger('click')
    await w.find('[data-testid="nav-menu"] [data-testid="menu-delete"]').trigger('click')
    expect(useStudio().getProject('P1')).toBeNull()
  })

  it('project menu can rename and create a new query', async () => {
    seed()
    vi.stubGlobal('prompt', () => 'Renamed project')
    const w = mount(StudioNav)
    await w.find('[data-testid="nav-project-menu"]').trigger('click')
    await w.find('[data-testid="nav-menu"] [data-testid="menu-rename"]').trigger('click')
    expect(useStudio().getProject('P1').name).toBe('Renamed project')
    // new query from the project menu creates + navigates to the editor
    await w.find('[data-testid="nav-project-menu"]').trigger('click')
    await w.find('[data-testid="nav-menu"] [data-testid="menu-new-query"]').trigger('click')
    expect(useStudio().getProject('P1').queries).toHaveLength(2)
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/\/studio\/p\/P1\/q\//))
  })

  it('query menu duplicates + deletes; clicking a query and the plot link navigates', async () => {
    seed(); routeParams = { projectId: 'P1' }
    vi.stubGlobal('confirm', () => true)
    const w = mount(StudioNav)
    // open a query -> editor route
    await w.find('[data-testid="studio-nav-query"] .srow-label').trigger('click')
    expect(push).toHaveBeenCalledWith('/studio/p/P1/q/Q1')
    // combine & plot link
    await w.find('.plot').trigger('click')
    expect(push).toHaveBeenCalledWith('/studio/p/P1/plot')
    // duplicate
    await w.find('[data-testid="nav-query-menu"]').trigger('click')
    await w.find('[data-testid="nav-menu"] [data-testid="menu-duplicate"]').trigger('click')
    expect(useStudio().getProject('P1').queries.length).toBe(2)
    // delete original
    await w.findAll('[data-testid="nav-query-menu"]')[0].trigger('click')
    await w.find('[data-testid="nav-menu"] [data-testid="menu-delete"]').trigger('click')
    expect(useStudio().getQuery('P1', 'Q1')).toBeNull()
  })
})
