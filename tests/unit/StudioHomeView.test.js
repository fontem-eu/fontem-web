import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
vi.mock('../../src/api/studio.js', async () => (await import('./helpers/studioApiMock.js')).makeStudioApiMock())
const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
import * as api from '../../src/api/studio.js'
import { useStudio } from '../../src/composables/useStudio.js'
import StudioHomeView from '../../src/views/StudioHomeView.vue'

const stubs = { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }
const mountView = () => mount(StudioHomeView, { global: { stubs } })

describe('StudioHomeView (server-backed)', () => {
  beforeEach(() => { api.__reset(); useStudio().reset(); push.mockReset() })

  it('shows an empty state with no projects', async () => {
    const w = mountView(); await flushPromises()
    expect(w.find('[data-testid="studio-empty"]').exists()).toBe(true)
  })

  it('lists projects from the server', async () => {
    api.__seed([{ id: 'p1', name: 'Watch', created_by: 'u', queries: [], plots: [] }])
    const w = mountView(); await flushPromises()
    expect(w.find('[data-testid="studio-project-card"]').text()).toContain('Watch')
  })

  it('new project creates via API and navigates', async () => {
    const w = mountView(); await flushPromises()
    await w.find('[data-testid="studio-new-project"]').trigger('click'); await flushPromises()
    expect(api.createProject).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/studio\/p\//))
  })
})
