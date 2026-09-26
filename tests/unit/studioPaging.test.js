import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
vi.mock('../../src/api/studio.js', async () => (await import('./helpers/studioApiMock.js')).makeStudioApiMock())
vi.mock('../../src/api/session.js', () => ({ currentUser: { value: { id: 'me' } } }))
let routeParams = {}
vi.mock('vue-router', () => ({ useRoute: () => ({ get params() { return routeParams } }), useRouter: () => ({ push: vi.fn() }) }))
import * as api from '../../src/api/studio.js'
import { useStudio } from '../../src/composables/useStudio.js'
import StudioNav from '../../src/components/StudioNav.vue'

// The DAST account's accumulated projects are why this exists: 1,147 of them,
// 3.26 MB, fetched by the rail on every page. The store now takes 30 at a time.
const owned = (n, by = 'me') => Array.from({ length: n }, (_, i) => ({
  id: `p${i}`, name: `Project ${i}`, created_by: by, updated_at: `2026-09-26T12:${String(59 - (i % 60)).padStart(2, '0')}:00Z`,
  queries: [], plots: [] }))

describe('useStudio — paged owner list', () => {
  beforeEach(() => { api.__reset(); useStudio().reset(); routeParams = {} })

  it('loads one page of thirty, not the whole list', async () => {
    api.__seed(owned(45))
    const studio = useStudio()
    await studio.ensureLoaded()
    expect(studio.projects.value).toHaveLength(30)
    expect(studio.hasMore.value).toBe(true)
    expect(api.listProjects).toHaveBeenLastCalledWith({ limit: 30 })
  })

  it('loads the next page from the cursor, then knows it is done', async () => {
    api.__seed(owned(45))
    const studio = useStudio()
    await studio.ensureLoaded()
    await studio.loadMore()
    expect(studio.projects.value.map((p) => p.id)).toEqual(owned(45).map((p) => p.id))
    expect(api.listProjects.mock.calls.at(-1)[0].before).toMatch(/\|p29$/)
    expect(studio.hasMore.value).toBe(false)
  })

  it('reads a pre-paging API that returns everything as a complete list', async () => {
    api.__seed(owned(45))
    api.listProjects.mockImplementationOnce(async () => owned(45))
    const studio = useStudio()
    await studio.ensureLoaded()
    expect(studio.projects.value).toHaveLength(45)
    expect(studio.hasMore.value).toBe(false)
  })

  it('still opens a project beyond the loaded pages', async () => {
    api.__seed(owned(45))
    const studio = useStudio()
    await studio.ensureLoaded()
    const p = await studio.ensureProject('p40')
    expect(p.name).toBe('Project 40')
    expect(studio.getProject('p40')).not.toBeNull()
  })
})

describe('StudioNav under paging (the rail)', () => {
  beforeEach(() => { api.__reset(); useStudio().reset(); routeParams = {} })
  const names = (w) => w.findAll('[data-testid="nav-project-name"]').map((b) => b.text())

  it('says 30+ while more pages exist, instead of under-reporting', async () => {
    api.__seed(owned(45))
    const w = mount(StudioNav, { props: { limit: 8 } }); await flushPromises()
    expect(w.find('[data-testid="nav-all-projects"]').text()).toContain('30+')
  })

  it('keeps the project you are in, when it is yours and beyond page one', async () => {
    api.__seed(owned(45))
    routeParams = { projectId: 'p40' }
    await useStudio().ensureProject('p40')
    const w = mount(StudioNav, { props: { limit: 3 } }); await flushPromises()
    expect(names(w)).toEqual(['Project 0', 'Project 1', 'Project 2', 'Project 40'])
  })

  it('does not add a project someone else shared with you — it never was in the rail', async () => {
    api.__seed([...owned(3), { id: 'x9', name: 'Theirs', created_by: 'someone', queries: [], plots: [] }])
    api.listProjects.mockImplementation(async () => owned(3))
    routeParams = { projectId: 'x9' }
    await useStudio().ensureProject('x9')
    const w = mount(StudioNav, { props: { limit: 8 } }); await flushPromises()
    expect(names(w)).not.toContain('Theirs')
  })
})
