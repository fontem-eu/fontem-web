import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const push = vi.fn(); const replace = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { projectId: 'P1' } }),
  useRouter: () => ({ push, replace }),
}))
import { useStudio } from '../../src/composables/useStudio.js'
import StudioProjectView from '../../src/views/StudioProjectView.vue'

const stubs = { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }

function seed(queries = []) {
  localStorage.setItem('fontem-studio', JSON.stringify({ projects: [
    { id: 'P1', name: 'Corruption', createdAt: 't', plots: [], queries },
  ] }))
  useStudio().refresh()
}

describe('StudioProjectView (project overview)', () => {
  beforeEach(() => { localStorage.clear(); push.mockReset() })

  it('lists the project queries with a language badge', () => {
    seed([{ id: 'Q1', name: 'contracts', lang: 'cypher', query: 'MATCH (n) RETURN n', updatedAt: 't' }])
    const w = mount(StudioProjectView, { global: { stubs } })
    const rows = w.findAll('[data-testid="project-query"]')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('contracts')
    expect(rows[0].text()).toContain('Cypher')
  })

  it('shows an empty state with no queries', () => {
    seed([])
    const w = mount(StudioProjectView, { global: { stubs } })
    expect(w.text()).toContain('No queries yet')
  })

  it('new query creates one and navigates to its editor', async () => {
    seed([])
    const w = mount(StudioProjectView, { global: { stubs } })
    await w.find('[data-testid="project-new-query"]').trigger('click'); await flushPromises()
    expect(useStudio().getProject('P1').queries).toHaveLength(1)
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/studio\/p\/P1\/q\//))
  })
})
