import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
import { useStudio } from '../../src/composables/useStudio.js'
import StudioHomeView from '../../src/views/StudioHomeView.vue'

const stubs = { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }

describe('StudioHomeView', () => {
  beforeEach(() => { localStorage.clear(); useStudio().refresh(); push.mockReset() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('shows an empty state with no projects', () => {
    const w = mount(StudioHomeView, { global: { stubs } })
    expect(w.find('[data-testid="studio-empty"]').exists()).toBe(true)
  })

  it('lists projects as cards', () => {
    useStudio().createProject('Watch')
    const w = mount(StudioHomeView, { global: { stubs } })
    expect(w.find('[data-testid="studio-project-card"]').text()).toContain('Watch')
  })

  it('new project prompts, creates, and navigates', async () => {
    vi.stubGlobal('prompt', () => 'New one')
    const w = mount(StudioHomeView, { global: { stubs } })
    await w.find('[data-testid="studio-new-project"]').trigger('click'); await flushPromises()
    expect(useStudio().projects.value[0].name).toBe('New one')
    expect(push).toHaveBeenCalled()
  })

  it('cancelling the prompt creates nothing', async () => {
    vi.stubGlobal('prompt', () => null)
    const w = mount(StudioHomeView, { global: { stubs } })
    await w.find('[data-testid="studio-new-project"]').trigger('click'); await flushPromises()
    expect(useStudio().projects.value).toHaveLength(0)
  })
})
